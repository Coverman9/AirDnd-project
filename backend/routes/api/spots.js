const express = require("express");
const { setTokenCookie, requireAuth } = require("../../utils/auth");
const createSpotValidation = require("../../utils/spot-validation.js");
const createReviewValidation = require("../../utils/review-validation.js");
const spotQueryValidation = require("../../utils/query-validation.js");
const {
  User,
  Spot,
  SpotImage,
  Review,
  ReviewImage,
  Booking,
  sequelize,
} = require("../../db/models");

const { Op } = require("sequelize");

const router = express.Router();

// Query Filters to Get All Spots
router.get("/", spotQueryValidation, async (req, res) => {
  let { page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice } =
    req.query;

  const where = {};
  const pagination = {};

  if (!page) page = 1;
  if (!size) size = 20;

  if (parseInt(page) > 10) page = 10;
  if (parseInt(size) > 20) size = 20;

  if (parseInt(page) && parseInt(size)) {
    pagination.limit = size;
    pagination.offset = size * (page - 1);
  }

  if (req.query.minLat && req.query.maxLat) {
    where.lat = { [Op.gte]: Number(minLat), [Op.lte]: Number(maxLat) };
  } else if (req.query.minLat) {
    where.lat = { [Op.gte]: Number(minLat) };
  } else if (req.query.maxLat) {
    where.lat = { [Op.lte]: Number(maxLat) };
  }

  if (req.query.minLng && req.query.maxLng) {
    where.lng = { [Op.gte]: Number(minLng), [Op.lte]: Number(maxLng) };
  } else if (req.query.minLng) {
    where.lng = { [Op.gte]: Number(minLng) };
  } else if (req.query.maxLng) {
    where.lng = { [Op.lte]: Number(maxLng) };
  }

  if (req.query.minPrice && req.query.maxPrice) {
    where.price = { [Op.gte]: Number(minPrice), [Op.lte]: Number(maxPrice) };
  } else if (req.query.minPrice) {
    where.price = { [Op.gte]: Number(minPrice) };
  } else if (req.query.maxPrice) {
    where.price = { [Op.lte]: Number(maxPrice) };
  }

  const spots = await Spot.findAll({
    where,
    ...pagination,
    include: [
      {
        model: SpotImage,
        attributes: ["url", "preview"],
      },
    ],
  });

  const spotObjects = [];
  if (spots.length) {
    spots.forEach((spot) => spotObjects.push(spot.toJSON()));
  } else {
    spotObjects.push(spots);
  }

  for (let spot of spotObjects) {
    if (!Object.keys(spot).length) break;
    const review = await Review.findOne({
      where: {
        spotId: spot.id,
      },
      attributes: [[sequelize.fn("AVG", sequelize.col("stars")), "avgRating"]],
    });
    if (review && review.toJSON().avgRating > 0) {
      spot.avgRating = Number(review.toJSON().avgRating).toFixed(1);
    } else spot.avgRating = "No Reviews exist for this spot";

    if (spot.SpotImages.length) {
      const filterTrue = spot.SpotImages.filter(
        (image) => image.preview === true
      );
      if (filterTrue.length) {
        spot.previewImage = filterTrue[0].url;
      } else {
        spot.previewImage = "No Preview Image Available";
      }
    } else {
      spot.previewImage = "No Preview Image Available";
    }
    delete spot.SpotImages;
  }
  res.json({
    Spots: spotObjects,
    page: page,
    size: size,
  });
});

//Get all Bookings for a Spot based on the Spot's id
router.get("/:spotId/bookings", requireAuth, async (req, res, next) => {
  const { user } = req;

  const spot = await Spot.findByPk(req.params.spotId);
  if (!spot) {
    const err = new Error("Spot couldn't be found");
    err.status = 404;
    return next(err);
  }

  if (spot.ownerId === user.id) {
    const bookings = await Booking.findAll({
      where: { spotId: req.params.spotId },
      include: [{ model: User, attributes: ["id", "firstName", "lastName"] }],
    });
    res.status(200);
    res.json({ Bookings: bookings });
  } else {
    const bookings = await Booking.findAll({
      where: { spotId: req.params.spotId },
      attributes: ["spotId", "startDate", "endDate"],
    });
    res.status(200);
    res.json({ Bookings: bookings });
  }
});


//Create a Booking from a Spot based on the Spot's id
router.post("/:spotId/bookings", requireAuth, async (req, res, next) => {
  let { startDate, endDate } = req.body;
  const { user } = req;

  startDate = new Date(startDate);
  endDate = new Date(endDate);
  let currentDate = new Date();

  const validationErrors = {};
  const conflictErrors = {};

  const spots = await Spot.findByPk(req.params.spotId, {
    include: [
      {
        model: Booking,
        attributes: ["id", "startDate", "endDate"],
      },
    ],
  });
  if (!spots) {
    const err = new Error("Spot couldn't be found");
    err.status = 404;
    return next(err);
  }
  if (spots.ownerId == user.id) {
    const err = new Error("Forbidden");
    err.status = 403;
    return next(err);
  }

  if (startDate < currentDate) {
    validationErrors.startDate = "startDate cannot be in the past";
  }
  if (endDate <= startDate) {
    // console.log("asdasd");
    validationErrors.endDate = "endDate cannot be on or before startDate";
  }
  if (Object.keys(validationErrors).length) {
    const err = Error("Bad Request");
    err.errors = validationErrors;
    err.status = 400;
    return next(err);
  }

  const spot = spots.toJSON();
  if (spot.Bookings.length) {
    for (let book of spot.Bookings) {
      if (startDate >= book.startDate && endDate <= book.endDate) {
        conflictErrors.startDate =
          "Start date conflicts with an existing booking";
        conflictErrors.endDate = "End date conflicts with an existing booking";
      } else if (startDate.getTime() === book.startDate.getTime()) {
        conflictErrors.startDate =
          "Start date conflicts with an existing booking";
      } else if (startDate < book.startDate && endDate > book.startDate) {
        conflictErrors.endDate = "End date conflicts with an existing booking";
      } else if (startDate > book.startDate && startDate < book.endDate) {
        conflictErrors.startDate =
          "Start date conflicts with an existing booking";
      }
    }
  }

  if (Object.keys(conflictErrors).length) {
    const err = Error(
      "Sorry, this spot is already booked for the specified dates"
    );
    err.errors = conflictErrors;
    err.status = 403;
    return next(err);
  }

  const booking = await Booking.create({
    spotId: Number(req.params.spotId),
    userId: user.id,
    startDate,
    endDate,
  });

  res.json(booking);
});

//Get all Reviews by a Spot's id
router.get("/:spotId/reviews", async (req, res, next) => {
  const review = await Review.findAll({
    where: {
      spotId: req.params.spotId,
    },
    include: [
      {
        model: User,
        attributes: ["id", "firstName", "lastName"],
      },
      {
        model: ReviewImage,
        attributes: ["id", "url"],
      },
    ],
  });

  if (!review.length) {
    const err = new Error("Spot couldn't be found");
    err.status = 404;
    return next(err);
  }

  res.json({
    Reviews: review,
  });
});

//Create a Review for a Spot based on the Spot's id
router.post(
  "/:spotId/reviews",
  requireAuth,
  createReviewValidation,
  async (req, res, next) => {
    const { user } = req;
    const { review, stars } = req.body;
    const spotId = parseInt(req.params.spotId);

    const spot = await Spot.findByPk(req.params.spotId, {
      include: [{ model: Review, attributes: ["userId"] }],
    });
    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.status = 404;
      return next(err);
    }
    for (let review of spot.Reviews) {
      if (review.userId === user.id) {
        const err = new Error("User already has a review for this spot");
        err.status = 403;
        return next(err);
      }
    }
    const newReview = await Review.create({
      userId: user.id,
      spotId: spotId,
      review,
      stars,
    });
    res.status(201);

    res.json(newReview);
  }
);

//Get al Spots
router.get("/", async (req, res) => {
  const spots = await Spot.findAll({
    include: [
      {
        model: SpotImage,
        attributes: ["url", "preview"],
      },
    ],
  });

  const spotObjects = [];
  if (spots.length) {
    spots.forEach((spot) => spotObjects.push(spot.toJSON()));
  } else {
    spotObjects.push(spots);
  }

  for (let spot of spotObjects) {
    if (!Object.keys(spot).length) break;
    const review = await Review.findOne({
      where: {
        spotId: spot.id,
      },
      attributes: [[sequelize.fn("AVG", sequelize.col("stars")), "avgRating"]],
    });
    if (review && review.toJSON().avgRating > 0) {
      spot.avgRating = Number(review.toJSON().avgRating).toFixed(1);
    } else spot.avgRating = "No Reviews exist for this spot";

    if (spot.SpotImages.length) {
      const filterTrue = spot.SpotImages.filter(
        (image) => image.preview === true
      );
      if (filterTrue.length) {
        spot.previewImage = filterTrue[0].url;
      } else {
        spot.previewImage = "No Preview Image Available";
      }
    } else {
      spot.previewImage = "No Preview Image Available";
    }
    delete spot.SpotImages;
  }

  res.json({
    Spots: spotObjects,
  });
});

//Get all Spots owned by the Current User
router.get("/current", requireAuth, async (req, res) => {
  const { user } = req;
  const currents = await Spot.findAll({
    where: {
      ownerId: user.id,
    },
    include: [
      {
        model: SpotImage,
        attributes: ["url", "preview"],
      },
    ],
  });

  const spotObjects = [];
  if (currents.length) {
    currents.forEach((currentSpot) => spotObjects.push(currentSpot.toJSON()));
  } else {
    spotObjects.push(currents);
  }

  for (let spot of spotObjects) {
    //console.log(spot);
    if (!Object.keys(spot).length) break;
    const review = await Review.findOne({
      where: {
        spotId: spot.id,
      },
      attributes: [[sequelize.fn("AVG", sequelize.col("stars")), "avgRating"]],
    });
    if (review && review.toJSON().avgRating > 0) {
      spot.avgRating = Number(review.toJSON().avgRating).toFixed(1);
    } else spot.avgRating = "No Reviews exist for this spot";

    if (spot.SpotImages.length) {
      const filterTrue = spot.SpotImages.filter(
        (image) => image.preview === true
      );
      if (filterTrue.length) {
        spot.previewImage = filterTrue[0].url;
      } else {
        spot.previewImage = "No Preview Image Available";
      }
    } else {
      spot.previewImage = "No Preview Image Available";
    }
    delete spot.SpotImages;
  }

  res.json({
    Spots: spotObjects,
  });
});

//Get details of a Spot from an id
router.get("/:spotId", async (req, res, next) => {
  const spot = await Spot.findByPk(req.params.spotId, {
    include: [
      {
        model: SpotImage,
        attributes: ["id", "url", "preview"],
      },
      {
        model: User,
        attributes: ["id", "firstName", "lastName"],
      },
    ],
  });

  if (!spot) {
    const err = new Error("Spot couldn't be found");
    err.status = 404;
    return next(err);
  }

  const spotObject = spot.toJSON();

  const review = await Review.findOne({
    where: {
      spotId: spot.id,
    },
    attributes: [
      [sequelize.fn("AVG", sequelize.col("stars")), "avgRating"],
      [sequelize.fn("COUNT", sequelize.col("stars")), "numReviews"],
    ],
  });

  if (review) {
    spotObject.numReviews = Number(review.toJSON().numReviews);
    spotObject.avgStarRating = Number(review.toJSON().avgRating);
  } else {
    spotObject.numReviews = 0;
    spotObject.avgStarRating = "No Reviews exist for this spot";
  }

  if (spotObject.User) {
    spotObject.Owner = spotObject.User;
    delete spotObject.User;
  }

  res.json(spotObject);
});

//Create a Spot
router.post("/", requireAuth, createSpotValidation, async (req, res) => {
  const { user } = req;
  const { address, city, state, country, lat, lng, name, description, price } =
    req.body;

  const newSpot = await Spot.create({
    ownerId: user.id,
    address,
    city,
    state,
    country,
    lat,
    lng,
    name,
    description,
    price,
  });
  res.status(201);
  res.json(newSpot);
});

//Add an Image to a Spot based on the Spot's id
router.post("/:spotId/images", requireAuth, async (req, res, next) => {
  const { user } = req;
  const { url, preview } = req.body;

  const spot = await Spot.findByPk(req.params.spotId);
  if (!spot) {
    const err = new Error("Spot couldn't be found");
    err.status = 404;
    return next(err);
  }
  const newImg = await spot.createSpotImage({
    url,
    preview,
  });

  res.status(200);
  res.json({
    id: newImg.id,
    url: newImg.url,
    preview: newImg.preview,
  });
});

//Edit a Spot
router.put(
  "/:spotId",
  requireAuth,
  createSpotValidation,
  async (req, res, next) => {
    const { user } = req;
    const {
      address,
      city,
      state,
      country,
      lat,
      lng,
      name,
      description,
      price,
    } = req.body;
    const spot = await Spot.findByPk(req.params.spotId);
    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.status = 404;
      return next(err);
    }
    if (spot.ownerId != user.id) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    await spot.update({
      address,
      city,
      state,
      country,
      lat,
      lng,
      name,
      description,
      price,
    });
    res.json(spot);
  }
);

//Delete a Spot
router.delete("/:spotId", requireAuth, async (req, res, next) => {
  const { user } = req;

  const deleteSpot = await Spot.findByPk(req.params.spotId);
  if (!deleteSpot) {
    const err = new Error("Spot couldn't be found");
    err.status = 404;
    return next(err);
  }

  await deleteSpot.destroy();
  res.status(200);
  res.json({
    message: "Successfully deleted",
  });
});

module.exports = router;
