const db = require('../../config/db');
const User = require('../models/User');

class BadgeService {
    static async getUserStats(userId) {
        // Проверяем, не админ ли пользователь
        const user = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (user.rows[0]?.role === 'admin') {
            return {
                events_attended: 0,
                problems_solved: 0,
                problems_reported: 0,
                problems_confirmed: 0,
                skills_count: 0
            };
        }
        
        const result = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM event_participants WHERE user_id = $1 AND status = 'attended') as events_attended,
                (SELECT COUNT(*) FROM problems WHERE assigned_to_user = $1 AND status = 'closed') as problems_solved,
                (SELECT COUNT(*) FROM problems WHERE created_by = $1) as problems_reported,
                (SELECT COUNT(*) FROM problem_confirmations WHERE user_id = $1) as problems_confirmed,
                (SELECT COUNT(*) FROM user_skills WHERE user_id = $1) as skills_count
        `, [userId]);
        
        return result.rows[0];
    }
    
    static async checkAndAwardBadges(userId) {
        const stats = await this.getUserStats(userId);
        
        const badges = await db.query(`
            SELECT id, title, condition_type, condition_value 
            FROM badges 
            WHERE condition_type IS NOT NULL
        `);
        
        const awardedBadges = [];
        
        for (const badge of badges.rows) {
            // Проверяем, есть ли уже у пользователя этот бейдж
            const hasBadge = await db.query(
                'SELECT id FROM user_badges WHERE user_id = $1 AND badge_id = $2',
                [userId, badge.id]
            );
            
            if (hasBadge.rows.length > 0) continue;
            
            let conditionMet = false;
            
            switch (badge.condition_type) {
                case 'events_attended':
                    conditionMet = stats.events_attended >= badge.condition_value;
                    break;
                case 'problems_solved':
                    conditionMet = stats.problems_solved >= badge.condition_value;
                    break;
                case 'problems_reported':
                    conditionMet = stats.problems_reported >= badge.condition_value;
                    break;
                case 'problems_confirmed':
                    conditionMet = stats.problems_confirmed >= badge.condition_value;
                    break;
                case 'skills_count':
                    conditionMet = stats.skills_count >= badge.condition_value;
                    break;
            }
            
            if (conditionMet) {
                await User.addBadge(userId, badge.id);
                awardedBadges.push(badge.title);
            }
        }
        
        return awardedBadges;
    }
    
    static async onUserAction(userId, actionType) {
        // Админам не выдаем бейджи
        const user = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (user.rows[0]?.role === 'admin') return [];
        
        const awarded = await this.checkAndAwardBadges(userId);
        if (awarded.length > 0) {
            console.log(`🎉 User ${userId} earned badges: ${awarded.join(', ')}`);
        }
        return awarded;
    }
}

module.exports = BadgeService;