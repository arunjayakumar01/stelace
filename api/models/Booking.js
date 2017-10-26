/* global
    Assessment, Booking, Conversation, Listing, TimeService
*/

/**
* Booking.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        listingId: {
            type: "integer",
            index: true
        },
        listingSnapshotId: {
            type: "integer",
            index: true
        },
        listingTypeId: 'integer',
        listingType: 'json',
        paidDate: 'string', // taker action, set if paymentDate and depositDate are set
        acceptedDate: 'string', // owner action, when accepting the booking
        autoAcceptation: {
            type: 'boolean',
            defaultsTo: false,
        },
        ownerId: {
            type: "integer",
            index: true
        },
        takerId: {
            type: "integer",
            index: true
        },
        quantity: {
            type: 'integer',
            defaultsTo: 1,
        },
        startDate: "string",
        endDate: "string",
        nbTimeUnits: 'integer',
        timeUnit: 'string',
        timeUnitPrice: "float",
        currency: 'string',
        ownerPrice: "float", // displayed price set by owner
        takerPrice: "float", // after rebate and fees
        ownerFees: "float", // set the value in case the formula change
        takerFees: "float", // set the value in case the formula change
        priceData: {
            type: 'json',
            defaultsTo: {},
        },
        options: {
            type: 'json',
            defaultsTo: {},
        },
        pricingId: "integer",
        customPricingConfig: "json",
        deposit: "float",
        dates: {
            type: 'json',
            defaultsTo: {},
        },
        completedDate: 'string',
        paymentCompleted: 'boolean',

        paymentDate: "string", // taker action, set when preauth payment is done
        depositDate: "string", // taker action, set when preauth deposit is done
        releaseDepositDate: "string", // renew deposit until this date, after the deposit must be cancelled
        paymentUsedDate: "string", // set when preauth payment is used
        paymentTransferDate: "string", // set when the payment can be withdrawn by the owner
        withdrawalDate: "string", // owner action, set when the withdrawal is done

        cancellationId: {
            type: "integer",
            index: true
        },
        cancellationPaymentDate: "string",
        cancellationDepositDate: "string",
        stopRenewDeposit: {
            type: "boolean",
            defaultsTo: false
        },
        contractId: "string",
    },

    getAccessFields: getAccessFields,

    isValidDates: isValidDates,
    computeEndDate,
    getAgreementUserId: getAgreementUserId,
    isValidationTooLate: isValidationTooLate,
    isNoTime: isNoTime,
    getLaunchDate: getLaunchDate,
    getDueDate: getDueDate,
    updateBookingEndState: updateBookingEndState,
    canListingQuantityEvolve: canListingQuantityEvolve,
    updateListingQuantity: updateListingQuantity,

    getLast: getLast,
    isComplete: isComplete,
    getAssessments: getAssessments,
    getBookingRef: getBookingRef,
    getPendingBookings: getPendingBookings,
    filterVisibleBookings: filterVisibleBookings,

};

var moment = require('moment');

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "listingId",
            "listingSnapshotId",
            "listingTypeId",
            "listingType",
            "parentId",
            "paidDate",
            "acceptedDate",
            "autoAcceptation",
            "ownerId",
            "takerId",
            "quantity",
            "startDate",
            "endDate",
            "nbTimeUnits",
            "timeUnit",
            "timeUnitPrice",
            "ownerPrice",
            "priceData",
            "takerPrice",
            "deposit",
            "ownerFees",
            "takerFees",
            "paymentDate",
            "depositDate",
            "cancellationId"
        ],
        owner: [
            "id",
            "listingId",
            "listingSnapshotId",
            "listingTypeId",
            "listingType",
            "parentId",
            "paidDate",
            "acceptedDate",
            "autoAcceptation",
            "ownerId",
            "takerId",
            "quantity",
            "startDate",
            "endDate",
            "nbTimeUnits",
            "timeUnit",
            "timeUnitPrice",
            "ownerPrice",
            "priceData",
            "takerPrice",
            "deposit",
            "ownerFees",
            "takerFees",
            "paymentDate",
            "depositDate",
            "paymentTransferDate",
            "withdrawalDate",
            "cancellationId"
        ],
        others: [
            "id",
            "listingId",
            "listingTypeId",
            "listingType",
            "parentId",
            "ownerId",
            "takerId",
            "startDate",
            "endDate",
            "quantity",
            "nbTimeUnits",
            "timeUnit",
            "cancellationId"
        ]
    };

    return accessFields[access];
}

/**
 * Check if booking dates are valid when calendar needed based on listing type config
 * @param  {String}  startDate
 * @param  {Number}  nbTimeUnits
 * @param  {String}  refDate
 * @param  {Object}  config
 * @return {Boolean}
 */
function isValidDates({
    startDate,
    nbTimeUnits,
    refDate,
    config,
}) {
    const errors          = {};
    const badParamsErrors = {};

    if (!TimeService.isDateString(startDate)) {
        badParamsErrors.BAD_FORMAT_START_DATE = true;
    }
    if (!TimeService.isDateString(refDate)) {
        badParamsErrors.MISSING_REF_DATE = true;
    }
    if (! _.isEmpty(badParamsErrors)) {
        errors.BAD_PARAMS = badParamsErrors;
        return exposeResult(errors);
    }

    let startDateMinLimit;
    let startDateMaxLimit;

    if (config.startDateMinDelta) {
        startDateMinLimit = moment(refDate).add(config.startDateMinDelta).toISOString();
    }
    if (config.startDateMaxDelta) {
        startDateMaxLimit = moment(refDate).add(config.startDateMaxDelta).toISOString();
    }

    let durationErrors  = {};
    let startDateErrors = {};

    if (nbTimeUnits <= 0) {
        durationErrors.INVALID = true;
    } else {
        if (nbTimeUnits && config.minDuration && nbTimeUnits < config.minDuration) {
            durationErrors.BELOW_MIN = true;
        }
        if (nbTimeUnits && config.maxDuration && config.maxDuration < nbTimeUnits) {
            durationErrors.ABOVE_MAX = true;
        }
    }
    if (startDateMinLimit && startDate < startDateMinLimit) {
        startDateErrors.BEFORE_MIN = true;
    }
    if (startDateMaxLimit && startDateMaxLimit < startDate) {
        startDateErrors.AFTER_MAX = true;
    }

    if (! _.isEmpty(durationErrors)) {
        errors.DURATION = durationErrors;
    }
    if (! _.isEmpty(startDateErrors)) {
        errors.START_DATE = startDateErrors;
    }

    return exposeResult(errors);



    function exposeResult(errors) {
        return {
            result: ! _.keys(errors).length,
            errors: errors
        };
    }
}

function computeEndDate({ startDate, nbTimeUnits, timeUnit }) {
    const duration = { [timeUnit]: nbTimeUnits };
    return moment(startDate).add(duration).toISOString();
}

function getAgreementUserId(booking) {
    return booking.ownerId;
}

function isValidationTooLate(booking, refDate) {
    // booking can't be accepted if paid and "7 days - 1 hour" after the paid date
    return booking.paidDate && moment(refDate).diff(booking.paidDate, "h") > 167;
}

function isNoTime(booking) {
    return booking.listingType.properties.TIME === 'NONE';
}

function getLaunchDate(booking) {
    if (booking.paidDate < booking.acceptedDate) {
        return booking.acceptedDate;
    } else {
        return booking.paidDate;
    }
}

/**
 * get due date
 * @param  {object} booking
 * @param  {string} type - one value of ["start", "end"]
 * @return {string} due date
 */
function getDueDate(booking, type) {
    var dueDate;

    if (! _.includes(["start", "end"], type)) {
        throw new Error("Bad type");
    }

    if (isNoTime(booking)) {
        dueDate = getLaunchDate(booking);
        dueDate = moment(dueDate).add(2, "d").format("YYYY-MM-DD");
    } else {
        if (type === "start") {
            dueDate = booking.startDate;
        } else { // type === "end"
            dueDate = booking.endDate;
        }
    }

    return dueDate;
}

function updateBookingEndState(booking, now) {
    return Promise.coroutine(function* () {
        // if already done
        if (booking.releaseDepositDate) {
            return booking;
        }

        const releaseDuration = booking.listingType.config.bookingTime.releaseDateAfterEndDate;

        // the deposit expires N days after the return date of the booking
        var updateAttrs = {
            releaseDepositDate: moment(now).add(releaseDuration).toISOString()
        };

        return yield Booking.updateOne(booking.id, updateAttrs);
    })();
}

function canListingQuantityEvolve(booking) {
    const { TIME, AVAILABILITY } = booking.listingType.properties;
    // listing quantity change if there is no time but there is a stock
    return TIME === 'NONE' && AVAILABILITY !== 'NONE';
}

/**
 * After some booking operations, listing quantity can evolve
 * like decrease stock after payment
 * or increase stock after booking rejection
 * @param {Object} booking
 * @param {String} actionType - possible values: ['add', 'remove']
 */
async function updateListingQuantity(booking, { actionType }) {
    if (!_.includes(['add', 'remove'], actionType)) {
        throw new Error('Incorrect action type');
    }

    if (!canListingQuantityEvolve(booking)) return;

    const listing = await Listing.findOne({ id: booking.listingId });
    if (!listing) {
        throw new NotFoundError();
    }

    const updateAttrs = {};
    if (actionType === 'add') {
        updateAttrs.quantity = listing.quantity + booking.quantity;
    } else if (actionType === 'remove') {
        updateAttrs.quantity = Math.max(listing.quantity - booking.quantity, 0);
    }

    await Listing.updateOne({ id: booking.listingId }, updateAttrs);
}

function getLast(listingIdOrIds) {
    var onlyOne;
    var listingIds;

    if (_.isArray(listingIdOrIds)) {
        listingIds = _.uniq(listingIdOrIds);
        onlyOne = false;
    } else {
        listingIds = listingIdOrIds;
        onlyOne = true;
    }

    return Promise.coroutine(function* () {
        var findAttrs = {
            listingId: listingIds,
            cancellationId: null,
            paidDate: { '!': null },
            acceptedDate: { '!': null }
        };

        if (onlyOne) {
            return yield Booking
                .findOne(findAttrs)
                .sort({ startDate: -1 });
        } else {
            var bookings = yield Booking
                .find(findAttrs)
                .sort({ startDate: -1 });

            var hashListings = _.reduce(listingIds, function (memo, listingId) {
                memo[listingId] = null;
                return memo;
            }, {});

            _.forEach(bookings, function (booking) {
                if (! hashListings[booking.listingId]) {
                    hashListings[booking.listingId] = booking;
                }
            });

            return hashListings;
        }
    })();
}

function isComplete(booking, inputAssessment, outputAssessment) {
    var result;

    result = booking.acceptedDate
        && booking.paidDate
        && ! booking.cancellationId
        && inputAssessment && inputAssessment.signedDate;

    // renting booking: input and output assessments signed
    // purchase booking: only input assessment signed
    if (! Booking.isNoTime(booking)) {
        result = result && (outputAssessment && outputAssessment.signedDate);
    }

    return !! result;
}

/**
 * Get visible assessments associated with bookings
 * @param  {Object} bookings
 * @return {Object} hashBookings
 * @return {Object} [hashBookings[bookingId].inputAssessment] - can be null
 * @return {Object} [hashBookings[bookingId].outputAssessment] - can be null
 */
async function getAssessments(bookings) {
    const bookingsIds = _.pluck(bookings, 'id');

    let assessments = await Assessment.find({
        or: [
            { startBookingId: bookingsIds },
            { endBookingId: bookingsIds },
        ],
    });

    const resultAssessments = await Assessment.filterConversationAssessments(assessments);
    assessments = resultAssessments.assessments;

    const indexedStart = _.indexBy(assessments, "startBookingId");
    const indexedEnd   = _.indexBy(assessments, "endBookingId");

    return _.reduce(bookings, (memo, booking) => {
        const inputAssessment              = indexedStart[booking.id];
        const outputAssessment             = indexedEnd[booking.id];

        memo[booking.id] = {
            inputAssessment: inputAssessment || null,
            outputAssessment: outputAssessment || null,
        };

        return memo;
    }, {});
}

function getBookingRef(bookingId) {
    return `BKG_${bookingId}`;
}

/**
 * Get bookings that are not paid or not validated
 * @param  {number}  listingId
 * @param  {object}  [args]
 * @param  {object}  [args.refBooking] - if provided, get pending bookings except this one
 * @param  {boolean} [args.intersection = false] - if true (refBooking needed), get only bookings that overlap the refBooking period
 * @return {object[]} bookings
 */
function getPendingBookings(listingId, args) {
    var refBooking   = args.refBooking;
    var intersection = args.intersection || false;

    return Promise.coroutine(function* () {
        var findAttrs = {
            listingId: listingId
        };

        if (refBooking) {
            _.assign(findAttrs, {
                id: { '!': refBooking.id }
            });

            // there is no period for a no-time booking
            if (intersection && ! Booking.isNoTime(refBooking)) {
                _.assign(findAttrs, {
                    startDate: { '<=': refBooking.endDate },
                    endDate: { '>=': refBooking.startDate },
                });
            }
        }

        _.assign(findAttrs, {
            or: [
                { paidDate: null },
                { acceptedDate: null }
            ],
            cancellationId: null
        });

        return yield Booking.find(findAttrs);
    })();
}

/**
 * filter visible bookings
 * visible bookings means:
 * - bookings that are in a conversation
 * - bookings that users can interact with (there can be multiples bookings in same conversation
 *     but only the most recent one is displayed)
 *
 * @param  {object[]} bookings
 *
 * @return {object}   res
 * @return {object[]} res.bookings
 * @return {object}   res.hashBookings
 * @return {object}   res.hashBookings[bookingId] - conversation
 */
function filterVisibleBookings(bookings) {
    return Promise.coroutine(function* () {
        var bookingsIds = _.pluck(bookings, "id");

        var conversations = yield Conversation.find({ bookingId: bookingsIds });

        var indexedConversations = _.indexBy(conversations, "bookingId");

        return _.reduce(bookings, (memo, booking) => {
            var conversation = indexedConversations[booking.id];
            if (conversation) {
                memo.bookings.push(booking);
                memo.hashBookings[booking.id] = conversation;
            }
            return memo;
        }, {
            bookings: [],
            hashBookings: {}
        });
    });
}
