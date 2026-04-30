// server/src/routes/organizationRoutes.js
const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { isAuthenticated } = require('../middleware/auth');
const { validateOrganizationMiddleware } = require('../middleware/validation');
const { uploadPosts } = require('../middleware/upload');

router.get('/feed', organizationController.getFeed);
router.get('/my-organizations', organizationController.getMyOrganizations);
router.get('/search', organizationController.searchOrganizations);

router.get('/api/search', organizationController.apiSearchOrganizations);
router.get('/api/:id/edit-data', organizationController.getOrganizationEditData);
router.put('/api/:id/edit', organizationController.updateOrganizationData);
router.post('/api/:id/moderators', organizationController.addModerator);
router.delete('/api/:id/moderators/:userId', organizationController.removeModerator);
router.get('/api/:id/available-users', organizationController.getAvailableUsers);
router.post('/requests', validateOrganizationMiddleware, organizationController.createOrganizationRequest);
router.get('/api/my-requests', organizationController.getUserOrganizationRequests);

// API для подписок
router.post('/:id/follow', isAuthenticated, organizationController.toggleFollow);
router.delete('/:id/follow', isAuthenticated, organizationController.toggleFollow);

// Посты
router.post('/:id/posts', isAuthenticated, uploadPosts, organizationController.createPost);
router.put('/posts/:id', isAuthenticated, uploadPosts, organizationController.updatePost);
router.delete('/posts/:id', isAuthenticated, organizationController.deletePost);
router.get('/:id/posts', organizationController.getOrganizationPosts);

router.get('/:id', organizationController.getOrganizationPage);

module.exports = router;