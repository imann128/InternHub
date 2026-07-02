const { body } = require('express-validator');

const submissionValidator = [
  body('task_id').notEmpty().isInt().withMessage('Valid task ID is required'),
  body('notes').optional().isString().isLength({ max: 2000 }).withMessage('Notes must be under 2000 characters'),
];

const reviewValidator = [
  body('status').notEmpty().isIn(['approved', 'rejected', 'revision_requested'])
    .withMessage('Status must be approved, rejected, or revision_requested'),
  body('score').optional().isInt({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
  body('feedback').optional().isString().isLength({ max: 2000 }).withMessage('Feedback must be under 2000 characters'),
];

module.exports = { submissionValidator, reviewValidator };
