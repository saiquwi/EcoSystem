const db = require('../../config/db');

class Organization {
    // Получить все организации
    static async findAll(filters = {}) {
        let query = `
            SELECT DISTINCT o.id, o.name, o.description, o.website, o.email, o.created_at
            FROM organizations o
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;
        
        if (filters.search) {
            query += ` AND (o.name ILIKE $${paramCount} OR o.email ILIKE $${paramCount})`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }
        
        query += ' ORDER BY o.created_at DESC';
        
        const result = await db.query(query, values);
        return result.rows;
    }
    
    // Найти организацию по ID
    static async findById(id) {
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            console.error('Invalid ID passed to findById:', id);
            return null;
        }
        
        const query = `
            SELECT o.id, o.name, o.description, o.website, o.email, o.created_at
            FROM organizations o
            WHERE o.id = $1
        `;
        const result = await db.query(query, [parsedId]);
        return result.rows[0];
    }
    
    // Создать организацию
    static async create(data) {
        const { name, description, website, email } = data;
        
        const query = `
            INSERT INTO organizations (name, description, website, email, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING id
        `;
        
        const result = await db.query(query, [name, description || null, website || null, email]);
        
        return { id: result.rows[0].id };
    }

    // Обновить организацию
    static async update(id, data) {
        const { name, description, website, email } = data;
        
        const query = `
            UPDATE organizations 
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                website = COALESCE($3, website),
                email = COALESCE($4, email)
            WHERE id = $5
            RETURNING id, name, description, website, email
        `;
        
        const result = await db.query(query, [name, description, website, email, id]);
        return result.rows[0];
    }
    
    // Удалить организацию
    static async delete(id) {
        // Сначала удаляем связи в organization_staff
        await db.query('DELETE FROM organizations_staff WHERE organization_id = $1', [id]);
        // Затем удаляем организацию
        const result = await db.query('DELETE FROM organizations WHERE id = $1 RETURNING id', [id]);
        return result.rows[0];
    }
    
    // Получить статистику по организациям
    static async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT o.id) as active
            FROM organizations o
        `;
        const result = await db.query(query);
        return result.rows[0];
    }
    
    // Получить последние N организаций
    static async getRecent(limit = 5) {
        const query = `
            SELECT DISTINCT o.id, o.name, o.email, o.created_at
            FROM organizations o
            ORDER BY o.created_at DESC
            LIMIT $1
        `;
        const result = await db.query(query, [limit]);
        return result.rows;
    }

    // Подписаться на организацию
    static async follow(organizationId, userId) {
        const query = `
            INSERT INTO organization_followers (organization_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (organization_id, user_id) DO NOTHING
            RETURNING id
        `;
        const result = await db.query(query, [organizationId, userId]);
        return result.rows[0];
    }

    // Отписаться от организации
    static async unfollow(organizationId, userId) {
        const query = `
            DELETE FROM organization_followers 
            WHERE organization_id = $1 AND user_id = $2
            RETURNING id
        `;
        const result = await db.query(query, [organizationId, userId]);
        return result.rows[0];
    }

    // Проверить, подписан ли пользователь
    static async isFollowing(organizationId, userId) {
        const query = `
            SELECT id FROM organization_followers 
            WHERE organization_id = $1 AND user_id = $2
        `;
        const result = await db.query(query, [organizationId, userId]);
        return result.rows.length > 0;
    }

    // Получить организации, на которые подписан пользователь
    static async getFollowedOrganizations(userId) {
        const query = `
            SELECT o.id, o.name, o.email, o.created_at
            FROM organizations o
            JOIN organization_followers of ON o.id = of.organization_id
            WHERE of.user_id = $1
            ORDER BY o.name ASC
        `;
        const result = await db.query(query, [userId]);
        return result.rows;
    }

    // Поиск организаций
    static async search(searchTerm, userId = null) {
        let query = `
            SELECT o.id, o.name, o.description, o.email,
                EXISTS(SELECT 1 FROM organization_followers WHERE organization_id = o.id AND user_id = $1) as is_following
            FROM organizations o
            WHERE o.name ILIKE $2 OR o.description ILIKE $2
            ORDER BY o.name
        `;
        const result = await db.query(query, [userId || 0, `%${searchTerm}%`]);
        return result.rows;
    }
}

module.exports = Organization;