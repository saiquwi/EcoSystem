const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');
const { validateRegistrationMiddleware, validateOrganizationMiddleware } = require('../middleware/validation');

// Все маршруты админ-панели требуют прав администратора
router.use(isAdmin);

router.get('/', adminController.getPanel);

router.get('/users', adminController.getUsers);
router.post('/users', validateRegistrationMiddleware, adminController.createUser);
router.delete('/users/:userId', adminController.deleteUser);

router.get('/problems', adminController.getProblems);
router.delete('/problems/:problemId', adminController.deleteProblem);

router.get('/organizations', adminController.getOrganizations);
router.get('/organizations/:organizationId', adminController.getOrganization);
router.post('/organizations/:organizationId', validateOrganizationMiddleware, adminController.updateOrganization);
router.post('/organizations', validateOrganizationMiddleware, adminController.createOrganization);
router.delete('/organizations/:organizationId', adminController.deleteOrganization);

router.get('/organization-requests', adminController.getOrganizationRequests);
router.post('/organization-requests/:requestId/approve', adminController.approveOrganizationRequest);
router.post('/organization-requests/:requestId/reject', adminController.rejectOrganizationRequest);

// User Skills (только просмотр, без добавления/удаления)
router.get('/users/:userId/skills', isAdmin, adminController.getUserSkills);

// User Badges (только просмотр, без добавления/удаления)
router.get('/users/:userId/badges', isAdmin, adminController.getUserBadges);

module.exports = router;