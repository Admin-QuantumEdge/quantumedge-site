const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


exports.handler = async (event) => {
    const { mt4_account } = JSON.parse(event.body);
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: 'your_price_id_here',
                quantity: 1
            }],
            mode: 'subscription',
            success_url: 'https://quantumedge.us/success.html',
            cancel_url: 'https://quantumedge.us/cancel.html',
            metadata: { mt4_account },
            allow_promotion_codes: true // Enables user-entered promo codes
            // Optional: discounts: [{ coupon: 'your_coupon_id_here' }] // Pre-applies a specific coupon
        });
        return {
            statusCode: 200,
            body: JSON.stringify({ sessionId: session.id })
        };
    } catch (error) {
        return { statusCode: 500, body: error.message };
    }
};
