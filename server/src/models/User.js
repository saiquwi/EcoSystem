const db = require('../../config/db');
const bcrypt = require('bcrypt');

class User {
    static ROLES = {
        VOLUNTEER: 'volunteer',
        ADMIN: 'admin'
    };

    // Создание нового пользователя
    static async create(userData) {
        const { email, password, name, bio } = userData;
        
        // Проверяем, не существует ли уже такой email
        const existing = await this.findByEmail(email);
        if (existing) {
            throw new Error('User with this email already exists');
        }

        // Хешируем пароль
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const query = `
            INSERT INTO users (email, password_hash, name, role, bio)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, name, role, bio, created_at
        `;
        
        const values = [
            email.toLowerCase(),
            passwordHash,
            name || email.split('@')[0],
            User.ROLES.VOLUNTEER,
            bio || null
        ];
        
        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user');
        }
    }

    // Поиск пользователя по email
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(query, [email.toLowerCase()]);
        return result.rows[0];
    }

    // Поиск пользователя по ID
    static async findById(id) {
        const query = `
            SELECT id, email, password_hash, name, role, bio, created_at
            FROM users 
            WHERE id = $1
        `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    // Проверка пароля
    static async validatePassword(user, password) {
        return bcrypt.compare(password, user.password_hash);
    }

    // Обновление профиля
    static async update(id, data) {
        const { email, name, bio, password } = data;
        
        let query = `UPDATE users SET `;
        const values = [];
        let paramCount = 1;
        const updates = [];
        
        // Обработка имени
        if (name !== undefined) {
            updates.push(`name = $${paramCount}`);
            values.push(name === '' ? null : name);
            paramCount++;
        }
        
        // Обработка bio (сохраняем null если пустая строка)
        if (bio !== undefined) {
            updates.push(`bio = $${paramCount}`);
            values.push(bio === '' ? null : bio);
            paramCount++;
        }
        
        // Добавляем email если передан
        if (email !== undefined) {
            updates.push(`email = $${paramCount}`);
            values.push(email);
            paramCount++;
        }
        
        // Добавляем пароль если передан
        if (password !== undefined) {
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            updates.push(`password_hash = $${paramCount}`);
            values.push(passwordHash);
            paramCount++;
        }
        
        query += updates.join(', ');
        query += ` WHERE id = $${paramCount} RETURNING id, email, name, role, bio, created_at`;
        values.push(id);
        
        const result = await db.query(query, values);
        return result.rows[0];
    }

    // Добавление навыка пользователю
    static async addSkill(userId, skillTitle) {
        const skillQuery = 'SELECT id FROM skills WHERE title = $1';
        const skillResult = await db.query(skillQuery, [skillTitle]);
        
        if (!skillResult.rows[0]) {
            throw new Error(`Skill "${skillTitle}" not found`);
        }
        
        const skillId = skillResult.rows[0].id;
        
        const query = `
            INSERT INTO user_skills (user_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, skill_id) DO NOTHING
            RETURNING id
        `;
        
        await db.query(query, [userId, skillId]);
        return true;
    }

    // Удаление навыка у пользователя
    static async removeSkill(userId, skillTitle) {
        const skillQuery = 'SELECT id FROM skills WHERE title = $1';
        const skillResult = await db.query(skillQuery, [skillTitle]);
        
        if (!skillResult.rows[0]) {
            return false;
        }
        
        const skillId = skillResult.rows[0].id;
        
        const query = 'DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2';
        await db.query(query, [userId, skillId]);
        return true;
    }

    // Получение всех навыков пользователя
    static async getUserSkills(userId) {
        const query = `
            SELECT s.id, s.title
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            WHERE us.user_id = $1
            ORDER BY s.title
        `;
        const result = await db.query(query, [userId]);
        return result.rows;
    }

    // Получение всех доступных навыков (справочник)
    static async getAllSkills() {
        const query = 'SELECT id, title FROM skills ORDER BY title';
        const result = await db.query(query);
        return result.rows;
    }

    // Получение бейджей пользователя
    static async getUserBadges(userId) {
        const query = `
            SELECT b.id, b.title, b.description, b.category, ub.earned_at
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            WHERE ub.user_id = $1
            ORDER BY ub.earned_at DESC
        `;
        const result = await db.query(query, [userId]);
        return result.rows;
    }

    static async addBadge(userId, badgeId) {
        const query = `
            INSERT INTO user_badges (user_id, badge_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, badge_id) DO NOTHING
            RETURNING id
        `;
        await db.query(query, [userId, badgeId]);
    }

    static async getUserStats(userId) {
        // Количество подтвержденных проблем
        const confirmationsQuery = `
            SELECT COUNT(*) as count 
            FROM problem_confirmations 
            WHERE user_id = $1
        `;
        const confirmationsResult = await db.query(confirmationsQuery, [userId]);
        
        // Количество решенных проблем
        const closedQuery = `
            SELECT COUNT(*) as count 
            FROM problems 
            WHERE assigned_to_user = $1 AND status = 'closed'
        `;
        const closedResult = await db.query(closedQuery, [userId]);
        
        // Количество посещенных событий
        const eventsQuery = `
            SELECT COUNT(*) as count 
            FROM event_participants 
            WHERE user_id = $1 AND status = 'attended'
        `;
        const eventsResult = await db.query(eventsQuery, [userId]);
        
        // Количество созданных проблем
        const createdQuery = `
            SELECT COUNT(*) as count 
            FROM problems 
            WHERE created_by = $1
        `;
        const createdResult = await db.query(createdQuery, [userId]);
        
        // Количество организованных событий
        const organizedQuery = `
            SELECT COUNT(*) as count 
            FROM events 
            WHERE created_by = $1
        `;
        const organizedResult = await db.query(organizedQuery, [userId]);
        
        return {
            problems_confirmed: parseInt(confirmationsResult.rows[0].count),
            problems_closed: parseInt(closedResult.rows[0].count),
            events_attended: parseInt(eventsResult.rows[0].count),
            problems_created: parseInt(createdResult.rows[0].count),
            events_organized: parseInt(organizedResult.rows[0].count),
            initiatives_organized: 0,
            initiatives_joined: 0
        };
    }

    static async getUserOrganizations(userId) {
        const query = `
            SELECT o.id, o.name, o.email, os.position
            FROM organizations o
            JOIN organizations_staff os ON o.id = os.organization_id
            WHERE os.user_id = $1
        `;
        const result = await db.query(query, [userId]);
        return result.rows;
    }

    static async isOrganizationStaff(userId, organizationId) {
        const query = `
            SELECT id FROM organizations_staff 
            WHERE organization_id = $1 AND user_id = $2
        `;
        const result = await db.query(query, [organizationId, userId]);
        return result.rows.length > 0;
    }

    static async isOrganizationOwner(userId, organizationId) {
        const query = `
            SELECT id FROM organizations_staff 
            WHERE organization_id = $1 AND user_id = $2 AND position = 'owner'
        `;
        const result = await db.query(query, [organizationId, userId]);
        return result.rows.length > 0;
    }

    // для админа
    static async findAll(filters = {}) {
        let query = `
            SELECT id, email, name, role, bio, created_at
            FROM users
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (filters.role) {
            query += ` AND role = $${paramCount}`;
            values.push(filters.role);
            paramCount++;
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
            paramCount++;
        }

        const result = await db.query(query, values);
        return result.rows;
    }

    static async updateRole(id, newRole) {
        if (!Object.values(this.ROLES).includes(newRole)) {
            throw new Error('Invalid role');
        }

        const query = `
            UPDATE users 
            SET role = $1
            WHERE id = $2
            RETURNING id, email, role
        `;
        
        const result = await db.query(query, [newRole, id]);
        return result.rows[0];
    }

    static async delete(id) {
        const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    static async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'volunteer' THEN 1 END) as volunteers,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
            FROM users
        `;
        const result = await db.query(query);
        return result.rows[0];
    }
}

module.exports = User;