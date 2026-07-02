const { body } = require('express-validator');

const locationValidator = [
  body('name').trim().notEmpty().withMessage('Location name is required'),
  body('latitude')
    .notEmpty().withMessage('Latitude is required')
    .bail()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .notEmpty().withMessage('Longitude is required')
    .bail()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('radius_meters')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 5000 }).withMessage('Radius must be between 1 and 5000 meters'),
];

module.exports = locationValidator;
