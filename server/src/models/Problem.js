const db = require('../../config/db');
const BadgeService = require('../services/badgeService');

class Problem {
    // Получить все проблемы
    static async findAll(filters = {}) {
        let query = `
            SELECT p.id, p.title, p.description, c.title as category, p.severity, p.status,
                   ST_X(p.location::geometry) as longitude,
                   ST_Y(p.location::geometry) as latitude,
                   p.created_at,
                   u.name as author_name,
                   (SELECT COUNT(*) FROM problem_confirmations WHERE problem_id = p.id) as confirmations
            FROM problems p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.status != 'deleted'
        `;
        const values = [];
        let paramCount = 1;
        
        // Фильтр по категории
        if (filters.category && filters.category !== 'all') {
            query += ` AND c.title = $${paramCount}`;
            values.push(filters.category);
            paramCount++;
        }
        
        // Фильтр по статусу
        if (filters.status && filters.status !== 'all') {
            query += ` AND p.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }
        
        query += ' ORDER BY p.created_at DESC';

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
            paramCount++;
        }
        
        const result = await db.query(query, values);
        return result.rows;
    }
    
    // Получить одну проблему по ID
    static async findById(id) {
        const query = `
            SELECT p.id, p.title, p.description, c.title as category, p.severity, p.status,
                ST_X(p.location::geometry) as longitude,
                ST_Y(p.location::geometry) as latitude,
                p.created_at, p.created_by,
                u.name as author_name,
                p.assigned_to_user,
                p.assigned_to_organization,
                p.photos,
                (SELECT COUNT(*) FROM problem_confirmations WHERE problem_id = p.id) as confirmations,
                (SELECT COUNT(*) FROM problem_resolution_confirmations WHERE problem_id = p.id) as resolution_confirmations
            FROM problems p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.id = $1 AND p.status != 'deleted'
        `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
    
    // Создать новую проблему
    static async create(data) {
        const { title, description, category, severity, latitude, longitude, userId, photos } = data;
        
        // Находим category_id по названию категории
        const categoryResult = await db.query('SELECT id FROM categories WHERE title = $1', [category]);
        
        if (!categoryResult.rows[0]) {
            throw new Error('Invalid category');
        }
        
        const categoryId = categoryResult.rows[0].id;
        
        const query = `
            INSERT INTO problems (title, description, location, category_id, severity, created_by, photos)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8)
            RETURNING id
        `;
        
        const result = await db.query(query, [
            title, 
            description, 
            longitude, 
            latitude, 
            categoryId, 
            severity || 1, 
            userId,
            photos || []  // массив путей к фото
        ]);
        
        return { id: result.rows[0].id };
    }
    
    // Подтвердить проблему
    static async confirm(problemId, userId) {
        // Проверяем, существует ли проблема
        const problem = await this.findById(problemId);
        if (!problem) {
            throw new Error('Problem not found');
        }
        
        // Добавляем подтверждение
        await db.query(`
            INSERT INTO problem_confirmations (problem_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (problem_id, user_id) DO NOTHING
        `, [problemId, userId]);
        
        // Проверяем, нужно ли автоматически подтвердить проблему (3+ подтверждений)
        const countResult = await db.query(`
            SELECT COUNT(*) as count FROM problem_confirmations WHERE problem_id = $1
        `, [problemId]);
        
        if (parseInt(countResult.rows[0].count) >= 3) {
            await db.query(`
                UPDATE problems SET status = 'confirmed' 
                WHERE id = $1 AND status = 'pending'
            `, [problemId]);
            return { status: 'confirmed' };
        }
        
        return { status: 'pending' };
    }
    
    // Взять проблему в работу
    static async take(problemId, userId) {
        const result = await db.query(`
            UPDATE problems 
            SET assigned_to_user = $1, status = 'in_progress'
            WHERE id = $2 AND status IN ('pending', 'confirmed')
            RETURNING id
        `, [userId, problemId]);
        
        if (result.rows.length === 0) {
            throw new Error('Problem cannot be taken');
        }
        
        return { id: result.rows[0].id };
    }
    
    static async complete(problemId, userId) {
        const result = await db.query(`
            UPDATE problems 
            SET status = 'completed'
            WHERE id = $1 AND assigned_to_user = $2 AND status = 'in_progress'
            RETURNING id
        `, [problemId, userId]);
        
        if (result.rows.length === 0) {
            throw new Error('Problem cannot be completed');
        }
        
        return { id: result.rows[0].id };
    }
    
    // Подтвердить решение проблемы (3 независимых пользователя)
    static async confirmResolution(problemId, userId) {
        // Проверяем, что пользователь не исполнитель
        const problem = await this.findById(problemId);
        if (!problem) throw new Error('Problem not found');
        if (problem.assigned_to_user === userId) {
            throw new Error('You cannot confirm your own resolution');
        }
        
        // Добавляем подтверждение
        await db.query(`
            INSERT INTO problem_resolution_confirmations (problem_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (problem_id, user_id) DO NOTHING
        `, [problemId, userId]);
        
        // Проверяем количество подтверждений
        const countResult = await db.query(`
            SELECT COUNT(*) as count FROM problem_resolution_confirmations WHERE problem_id = $1
        `, [problemId]);
        
        if (parseInt(countResult.rows[0].count) >= 3) {
            await db.query(`
                UPDATE problems 
                SET status = 'closed'
                WHERE id = $1 AND status = 'completed'
            `, [problemId]);

            if (problem.assigned_to_user) {
                await BadgeService.onUserAction(problem.assigned_to_user, 'problem_solved');
            }
            
            return { status: 'closed' };
        }
        
        return { status: 'completed' };
    }

    static async delete(problemId, userId) {
        // Проверяем, существует ли проблема и принадлежит ли пользователю
        const problem = await this.findById(problemId);
        if (!problem) {
            throw new Error('Problem not found');
        }
        
        if (problem.created_by !== userId) {
            throw new Error('You can only delete your own problems');
        }
        
        if (problem.status !== 'pending' && problem.status !== 'confirmed') {
            throw new Error('Cannot delete problem that is already in progress or completed');
        }
        
        // Полное удаление из базы
        const result = await db.query(`
            DELETE FROM problems 
            WHERE id = $1 AND created_by = $2
            RETURNING id
        `, [problemId, userId]);
        
        if (result.rows.length === 0) {
            throw new Error('Failed to delete problem');
        }
        
        return { id: result.rows[0].id };
    }
    
    // Получить все категории
    static async getAllCategories() {
        const result = await db.query('SELECT id, title FROM categories ORDER BY id ASC');
        return result.rows;
    }
    
    // Получить подтверждения проблемы
    static async getConfirmations(problemId) {
        const result = await db.query(`
            SELECT u.id, u.name, pc.created_at
            FROM problem_confirmations pc
            JOIN users u ON pc.user_id = u.id
            WHERE pc.problem_id = $1
            ORDER BY pc.created_at DESC
        `, [problemId]);
        return result.rows;
    }
    
    // Получить подтверждения решения
    static async getResolutionConfirmations(problemId) {
        const result = await db.query(`
            SELECT u.id, u.name, prc.comment, prc.created_at
            FROM problem_resolution_confirmations prc
            JOIN users u ON prc.user_id = u.id
            WHERE prc.problem_id = $1
            ORDER BY prc.created_at DESC
        `, [problemId]);
        return result.rows;
    }
}

module.exports = Problem;