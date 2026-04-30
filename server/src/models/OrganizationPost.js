const db = require('../../config/db');

class OrganizationPost {
    // Создать пост
    static async create(data) {
        const { organizationId, content, photos } = data;
        
        const query = `
            INSERT INTO organization_posts (organization_id, content, photos)
            VALUES ($1, $2, $3)
            RETURNING id, created_at
        `;
        
        const result = await db.query(query, [organizationId, content, photos || []]);
        return { id: result.rows[0].id };
    }

    // Обновить пост
    static async update(id, data) {
        const { content, photos } = data;
        
        const query = `
            UPDATE organization_posts 
            SET content = $1, photos = $2
            WHERE id = $3
            RETURNING id
        `;
        
        const result = await db.query(query, [content, photos || [], id]);
        return result.rows[0];
    }

    // Получить один пост
    static async findById(id) {
        const query = `
            SELECT p.id, p.content, p.photos, p.created_at,
                   o.id as organization_id, o.name as organization_name
            FROM organization_posts p
            JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = $1
        `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
    
    // Получить посты с пагинацией
    static async findAll(filters = {}) {
        let query = `
            SELECT op.id, op.content, op.photos, op.created_at,
                   o.id as organization_id, o.name as organization_name
            FROM organization_posts op
            JOIN organizations o ON op.organization_id = o.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;
        
        // Фильтр по организациям (если передан массив ID)
        if (filters.organizationIds && filters.organizationIds.length > 0) {
            query += ` AND op.organization_id = ANY($${paramCount}::int[])`;
            values.push(filters.organizationIds);
            paramCount++;
        }
        
        // Поиск по тексту
        if (filters.search) {
            query += ` AND op.content ILIKE $${paramCount}`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }
        
        query += ' ORDER BY op.created_at DESC';
        
        // Пагинация
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            values.push(filters.offset);
        }
        
        const result = await db.query(query, values);
        return result.rows;
    }
    
    // Получить посты конкретной организации
    static async findByOrganization(organizationId, limit = 10, offset = 0) {
        const query = `
            SELECT op.id, op.content, op.photos, op.created_at,
                   o.name as organization_name
            FROM organization_posts op
            JOIN organizations o ON op.organization_id = o.id
            WHERE op.organization_id = $1
            ORDER BY op.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(query, [organizationId, limit, offset]);
        return result.rows;
    }
    
    // Удалить пост (только для staff организации)
    static async delete(id, userId, organizationId) {
        const query = 'DELETE FROM organization_posts WHERE id = $1 RETURNING id';
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = OrganizationPost;