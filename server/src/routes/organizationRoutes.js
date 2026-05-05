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

// Ивенты
router.get('/api/events', organizationController.getEventsForMap);
router.get('/api/followed-organizations', isAuthenticated, organizationController.getFollowedOrganizationsIds);
router.get('/api/user-organizations', isAuthenticated, organizationController.getUserOrganizationsForSelect);
router.post('/events', isAuthenticated, organizationController.createEvent);
router.post('/events/:id/join', isAuthenticated, organizationController.joinEvent);
router.get('/events/:id/participants', isAuthenticated, organizationController.getEventParticipants);
router.put('/events/:id/participants/:userId', isAuthenticated, organizationController.updateParticipantStatus);
router.delete('/events/:id/participants/:userId', isAuthenticated, organizationController.removeParticipant);
router.put('/events/:id/status', isAuthenticated, organizationController.updateEventStatus);
router.put('/events/:id/date', isAuthenticated, organizationController.updateEventDate);
router.get('/events/:id', organizationController.getEvent);
router.delete('/events/:id/join', isAuthenticated, organizationController.cancelJoinEvent);

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