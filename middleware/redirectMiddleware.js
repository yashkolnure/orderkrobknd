// middleware/redirectMiddleware.js
const Redirect = require("../models/Redirect");

const redirectMiddleware = async (req, res, next) => {
  try {
    const reqPath = req.path.startsWith("/") ? req.path : "/" + req.path;

    // Find redirect, ignore any invalid full URLs in `from`
    const redirect = await Redirect.findOne({
      from: reqPath,
      from: { $not: { $regex: "^https?://" } },
    });

    if (redirect) {
      let target = redirect.to;
      // Ensure relative paths start with "/"
      if (!target.startsWith("/") && !target.startsWith("http")) {
        target = "/" + target;
      }
      return res.redirect(302, target);
    }

    next();
  } catch (err) {
    console.error("Redirect Middleware Error:", err);
    next();
  }
};

module.exports = redirectMiddleware;
