const { body } = require('express-validator');

const taskValidator = [
  body('intern_ids')
    .if(body('intern_id').not().exists())
    .isArray({ min: 1 })
    .withMessage('At least one intern required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('due_date').optional().isDate().withMessage('Invalid due date'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
];

// Edit never sends intern_id/intern_ids — TaskModel.update() doesn't accept
// them (reassigning a task to a different intern isn't part of "edit").
// Reusing taskValidator on the edit route was a bug: every edit would fail
// validation with "At least one intern required" since neither field is
// ever present in that route's payload.
const taskEditValidator = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('due_date').optional().isDate().withMessage('Invalid due date'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
];

const taskStatusValidator = [
  body('status')
    .notEmpty()
    .isIn(['pending', 'completed'])
    .withMessage('Status must be pending or completed'),
  body('due_date').optional().isDate().withMessage('Invalid due date'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
];

module.exports = { taskValidator, taskEditValidator, taskStatusValidator };
