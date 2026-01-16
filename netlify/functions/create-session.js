const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { mt4_account } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_30.00USD', // REAL Stripe price ID
          quantity: 1
        }
      ],
      success_url: 'https://quantumedge.us/success.html',
      cancel_url: 'https://quantumedge.us/cancel.html',
      metadata: {
        mt4_account: mt4_account
      },
      allow_promotion_codes: true
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

