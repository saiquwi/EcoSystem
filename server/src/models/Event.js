const db = require('../../config/db');

class Event {
    // Создать ивент
    static async create(data) {
        const { title, description, location, eventDate, maxVolunteers, organizationId, problemId, timezoneOffset } = data;
        
        const query = `
            INSERT INTO events (title, description, location, event_date, max_volunteers, organization_id, problem_id, timezone_offset)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        
        const result = await db.query(query, [
            title, description, location.lng, location.lat, 
            eventDate, maxVolunteers || null, organizationId, problemId || null, timezoneOffset || 0
        ]);
        
        return { id: result.rows[0].id };
    }
    
    // Получить ивент по ID
    static async findById(id) {
        const query = `
            SELECT e.id, e.title, e.description, 
                   ST_X(e.location::geometry) as longitude,
                   ST_Y(e.location::geometry) as latitude,
                   e.event_date, e.max_volunteers, e.current_volunteers, e.status,
                   e.organization_id, o.name as organization_name,
                   e.problem_id, e.created_at, e.timezone_offset
            FROM events e
            LEFT JOIN organizations o ON e.organization_id = o.id
            WHERE e.id = $1
        `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
    
    // Получить все ивенты с фильтрацией
    static async findAll(filters = {}) {
        console.log('Event.findAll filters:', filters);
        let query = `
            SELECT e.id, e.title, e.description, e.event_date, e.max_volunteers, e.current_volunteers, e.status,
                   ST_X(e.location::geometry) as longitude,
                   ST_Y(e.location::geometry) as latitude,
                   e.organization_id, o.name as organization_name,
                   e.problem_id, e.timezone_offset
            FROM events e
            LEFT JOIN organizations o ON e.organization_id = o.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;
        
        if (filters.organizationId) {
            query += ` AND e.organization_id = $${paramCount}`;
            values.push(filters.organizationId);
            paramCount++;
        }
        
        if (filters.organizationIds && filters.organizationIds.length > 0) {
            query += ` AND e.organization_id = ANY($${paramCount}::int[])`;
            values.push(filters.organizationIds);
            paramCount++;
        }
        
        if (filters.status && filters.status !== 'all') {
            query += ` AND e.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }
        
        if (filters.search) {
            query += ` AND e.title ILIKE $${paramCount}`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }
        
        query += ' ORDER BY e.event_date ASC';
        
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
    
    // Получить ивенты организации
    static async findByOrganization(organizationId, limit = 10, offset = 0) {
        return this.findAll({ organizationId, limit, offset });
    }
    
    // Записаться на ивент
    static async join(eventId, userId) {
        const query = `
            INSERT INTO event_participants (event_id, user_id, status)
            VALUES ($1, $2, 'registered')
            ON CONFLICT (event_id, user_id) DO NOTHING
            RETURNING id
        `;
        await db.query(query, [eventId, userId]);
        
        // Обновляем счетчик участников
        await db.query(`
            UPDATE events 
            SET current_volunteers = current_volunteers + 1
            WHERE id = $1
        `, [eventId]);
        
        return true;
    }
    
    // Проверить, записан ли пользователь
    static async isJoined(eventId, userId) {
        const query = `
            SELECT id FROM event_participants 
            WHERE event_id = $1 AND user_id = $2
        `;
        const result = await db.query(query, [eventId, userId]);
        return result.rows.length > 0;
    }
    
    // Обновить статус ивента
    static async updateStatus(eventId, status) {
        const query = `
            UPDATE events SET status = $1
            WHERE id = $2
            RETURNING id
        `;
        const result = await db.query(query, [status, eventId]);
        return result.rows[0];
    }

    // Отменить участие в ивенте
    static async cancelJoin(eventId, userId) {
        const query = `
            DELETE FROM event_participants 
            WHERE event_id = $1 AND user_id = $2
            RETURNING id
        `;
        const result = await db.query(query, [eventId, userId]);
        
        if (result.rows.length > 0) {
            await db.query(`
                UPDATE events 
                SET current_volunteers = current_volunteers - 1
                WHERE id = $1
            `, [eventId]);
        }
        
        return result.rows.length > 0;
    }

    static async getParticipants(eventId) {
        const query = `
            SELECT ep.id, ep.user_id, ep.status as participation_status, 
                u.name, u.email
            FROM event_participants ep
            JOIN users u ON ep.user_id = u.id
            WHERE ep.event_id = $1
            ORDER BY u.name ASC
        `;
        const result = await db.query(query, [eventId]);
        return result.rows;
    }

    // once every day at 12:00 UTC
    static async updateStatusesByTime() {
        const todayUTC = new Date();
        todayUTC.setUTCHours(0, 0, 0, 0);
        
        const result = await db.query(`
            UPDATE events 
            SET status = CASE 
                WHEN status = 'ongoing' THEN 'completed'
                WHEN status = 'planned' THEN 'cancelled'
                ELSE status
            END
            WHERE event_date < $1
            AND status IN ('ongoing', 'planned')
            RETURNING id, title, status, event_date
        `, [todayUTC]);
        
        if (result.rows.length > 0) {
            console.log(`Updated ${result.rows.length} event statuses:`, result.rows);
        }
        
        return result.rows;
    }
}

module.exports = Event;