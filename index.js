require("dotenv").config();
// const cors = require('cors');
var express=require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe=require('stripe')(process.env.STRIPE_SECRIT)
const port=8000||process.env.PORT;
var app=express();
const crypto = require('crypto');
const { count } = require("console");
app.use(cors());
// app.use(cors({
//   origin: ["https://www.ghidhaalruwhusa.com", "https://ghidhaalruwhusa.com"]
// }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.set('view engine','ejs');
app.get('/',(req,res)=>{
    res.render("index.ejs")
})

function encrypt(data, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
  let encrypted = cipher.update(data, 'utf8', 'hex'); // تأكد من أن data ليست undefined
  encrypted += cipher.final('hex');
  return encrypted;
  
}

app.post('/checkout', async (req, res) => {
  try {
      const price = parseInt(req.body.price, 10);
      const itmename = req.body.itmename;
      const userId = req.body.userId; // معرف المستخدم من Firebase
      const userEmail = req.body.userEmail; // البريد الإلكتروني
      const emaildata = req.body.userEmail; // البريد الإلكتروني
      const password = req.body.password;
      const successUrl = `https://ghidhaalruwhusa.com/success?email=${encodeURIComponent(emaildata)}&password=${encodeURIComponent(password)}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: itmename,
            },
            unit_amount: price,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: 'https://ghidhaalruwhusa.com/cancel',
        customer_email: userEmail, // تحديد البريد الإلكتروني هنا
        // automatic_tax: { enabled: true },//تفعيل الضرائب
      //   shipping_address_collection: { // ✅ يطلب عنوان العميل
      //     allowed_countries: ['US', 'CA', 'GB'] // أضف الدول التي تدعم الضرائب
      // },
        // phone

         automatic_tax: {
    enabled: true, // تفعيل الحساب التلقائي للضرائب
  },
        metadata: {
          productName:itmename,
          userId: userId, // تخزين معرف المستخدم في metadata
          // shippingAddress:shippingAddress
          
        },
         shipping_address_collection: {
    allowed_countries: ['US', 'CA', 'GB', 'SA'], // حدد الدول المسموحة
  },
      });
      // res.redirect(session.url); 
      res.json({ url: session.url });

  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error occurred');
  }
});
app.get('/getdata/:id', async (req, res) => {
  try {
      const paymentIntentId = req.params.id;
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // إرسال البيانات الوصفية مع تفاصيل الدفع
      res.json({
          client_secret: paymentIntent.client_secret,
          metadata: paymentIntent.metadata,
          amount_received: paymentIntent.amount_received
      });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error occurred');
  }
});


app.get('/checkout-sessions', async (req, res) => {
  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 1000,
      status: 'complete',
      expand: [
        'data.payment_intent.payment_method',
        'data.line_items',
        'data.customer_details' // هذا هو التوسيع الصحيح للبيانات الجغرافية
      ]
    });

    const sessionsWithoutEmail = sessions.data.filter(s => 
      s.customer_email || s.customer_details?.email
    );

    res.json({
      success: true,
      count: sessionsWithoutEmail.length,
      data: sessionsWithoutEmail.map(s => {
        // معلومات الدفع
        const paymentMethod = s.payment_intent?.payment_method;
        const cardInfo = paymentMethod?.type === 'card' ? {
          card_brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          country: paymentMethod.card.country
        } : null;

        // معلومات الموقع - الطريقة الصحيحة للوصول للبيانات
        const shippingAddress = s.shipping_details?.address || {};
        const billingAddress = s.customer_details?.address || {};
        
        const locationInfo = {
          shipping: {
            line1: shippingAddress.line1||"",
            line2: shippingAddress.line2 || '',
            city: shippingAddress.city||"",
            state: shippingAddress.state||"",
            postal_code: shippingAddress.postal_code||"",
            country: shippingAddress.country||""
          },
          billing: {
            line1: billingAddress.line1||"فارغ",
            line2: billingAddress.line2 || '',
            city: billingAddress.city||"فارغ",
            state: billingAddress.state||"فارغ",
            postal_code: billingAddress.postal_code||"فارغ",
            country: billingAddress.country||"فارغ"
          },
          country: shippingAddress.country || billingAddress.country || "فارغ"
        };

        return {
          id: s.id,
          tax: s.total_details?.amount_tax / 100 || 0,
          payment_status: s.payment_status,
          amount_total: s.amount_total / 100,
          currency: s.currency.toUpperCase(),
          customer_details: {
            email: s.customer_email || s.customer_details?.email||"",
            name: s.customer_details?.name||"فارغ",
            phone: s.customer_details?.phone||"فارغ"
          },
          payment_method: {
            type: paymentMethod?.type || 'unknown',
            ...(cardInfo || {})
          },
          products: s.line_items?.data.map(item => ({
            // id: item.id,
            name: item.description,
            price: item.price?.unit_amount / 100,
            quantity: item.quantity,
            // tax_rates: item.tax_rates?.map(rate => ({
            //   id: rate.id,
            //   percentage: rate.percentage,
            //   description: rate.description
            // })) || []
          })) || [],
          location: locationInfo,
          created: new Date(s.created * 1000).toISOString(),
          // metadata: s.metadata || {}
        };
      })
    });
  } catch (error) {
    console.error('Error fetching checkout sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/user-checkout-sessions', async (req, res) => {
  try {
    const userEmail = req.query.email; // الحصول على البريد الإلكتروني من query parameters
    
    if (!userEmail) {
      return res.status(400).json({ 
        success: false,
        error: 'Email parameter is required' 
      });
    }

    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'complete',
      expand: [
        'data.payment_intent.payment_method',
        'data.line_items',
        'data.customer_details'
      ]
    });

    // تصفية الجلسات الخاصة بالمستخدم فقط حسب البريد الإلكتروني
    const userSessions = sessions.data.filter(s => {
      const sessionEmail = s.customer_email || s.customer_details?.email;
      return sessionEmail?.toLowerCase() === userEmail.toLowerCase();
    });

    res.json({
      success: true,
      count: userSessions.length,
      data: userSessions.map(s => {
        const paymentMethod = s.payment_intent?.payment_method;
        const cardInfo = paymentMethod?.type === 'card' ? {
          card_brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          country: paymentMethod.card.country
        } : null;

        const shippingAddress = s.shipping_details?.address || {};
        const billingAddress = s.customer_details?.address || {};
        
        const locationInfo = {
          shipping: {
            line1: shippingAddress.line1 || "",
            line2: shippingAddress.line2 || '',
            city: shippingAddress.city || "",
            state: shippingAddress.state || "",
            postal_code: shippingAddress.postal_code || "",
            country: shippingAddress.country || ""
          },
          billing: {
            line1: billingAddress.line1 || "فارغ",
            line2: billingAddress.line2 || '',
            city: billingAddress.city || "فارغ",
            state: billingAddress.state || "فارغ",
            postal_code: billingAddress.postal_code || "فارغ",
            country: billingAddress.country || "فارغ"
          },
          country: shippingAddress.country || billingAddress.country || "فارغ"
        };

        return {
          tax: s.total_details?.amount_tax / 100 || 0,
          payment_status: s.payment_status,
          amount_total: s.amount_total / 100,
          currency: s.currency.toUpperCase(),
          customer_details: {
            email: s.customer_email || s.customer_details?.email || "",
            name: s.customer_details?.name || "فارغ",
            phone: s.customer_details?.phone || "فارغ"
          },
          payment_method: {
            type: paymentMethod?.type || 'unknown',
            ...(cardInfo || {})
          },
          products: s.line_items?.data.map(item => ({
            name: item.description,
            price: item.price?.unit_amount / 100,
            quantity: item.quantity
          })) || [],
          location: locationInfo,
          created: new Date(s.created * 1000).toISOString()
        };
      })
    });
  } catch (error) {
    console.error('Error fetching user checkout sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
//عمليات الدفع
// app.get('/checkout-sessions', async (req, res) => {
//   try {
//     const sessions = await stripe.checkout.sessions.list({
//       limit: 1000,
//             status: 'complete', // الفلترة الأساسية
//       expand: ['data.payment_intent.payment_method', 'data.line_items'] // التعديل هنا
//     });
//  const sessionsWithoutEmail = sessions.data.filter(s => 
//       s.customer_email !== null || s.customer_email === undefined
//     );
//     res.json({
//       success: true,
//       count:sessionsWithoutEmail.length,
//       data: sessionsWithoutEmail.map(s => {
//         // تحقق من وجود payment_intent و payment_method
//         const paymentMethod = s.payment_intent?.payment_method;
//         const cardInfo = paymentMethod?.type === 'card' ? {
//           card_brand: paymentMethod.card.brand,
//           last4: paymentMethod.card.last4,
//           country: paymentMethod.card.country
//         } : {
//           card_brand: null,
//           last4: null,
//           country: null
//         };

//         return {
//           id: s.id,
//            tax: s.total_details?.amount_tax / 100,
//           payment_status: s.payment_status,
//           amount_total: s.amount_total / 100,
//           currency: s.currency,
//           customer_email: s.customer_email,
//           payment_method_type: paymentMethod?.type || 'unknown',
//           ...cardInfo,
//           products: s.line_items?.data.map(item => ({
//             name: item.description,
//             price: item.price?.unit_amount / 100,
//             quantity: item.quantity

//             //  customer_email: s.customer_email,
// //         // id: s.id,
// //         payment_status: s.payment_status,
// //         amount_total: s.amount_total / 100,
// //         currency: s.currency,
          
// //         // // بيانات العميل
// //         // customer: {
// //         //   email: s.customer_details?.email || s.customer_email,
// //         //   name: s.customer_details?.name,
// //         //   phone: s.customer_details?.phone
// //         // },
        
// //         // // الشحن والعنوان
// //         // shipping: s.shipping_details ? {
// //         //   address: `${s.shipping_details.address?.line1}, ${s.shipping_details.address?.city}`
// //         // } : null,
        
// //         // المنتجات
// //         products: s.line_items?.data.map(item => ({
// //           name: item.description,
// //           price: item.price?.unit_amount / 100,
// //           quantity: item.quantity
// //         })),
// //         created: new Date(s.created * 1000),
// //            payment_method_type: paymentMethod?.type || 'unknown',
// //           ...cardInfo,
// //         // ضريبة وخصومات
// //         // tax: s.total_details?.amount_tax / 100,
// //         // discount: s.total_details?.amount_discount / 100,
        
// //         // // تواريخ
// //         // created: new Date(s.created * 1000),
// //         // expires_at: s.expires_at ? new Date(s.expires_at * 1000) : null,
        
// //         // // بيانات مخصصة
// //         // metadata: s.metadata,
        
// //         // روابط
// //         // receipt_url: s.invoice?.pdf || s.charges?.data[0]?.receipt_url
//           })),
//           created: new Date(s.created * 1000)
//         };
//       })
//     });
//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });
//بيانات الضرائب
app.get('/checkout-sessions-taxes', async (req, res) => {
  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'complete',
      expand: [
        'data.total_details.breakdown.taxes',
        'data.payment_intent.payment_method'
      ]
    });

    const sessionsWithTaxes = sessions.data.filter(s => 
      s.total_details?.breakdown?.taxes?.length > 0
    );

    const result = await Promise.all(sessionsWithTaxes.map(async (s) => {
      const shippingCountry = s.shipping_details?.address?.country;
      const billingCountry = s.payment_intent?.payment_method?.billing_details?.address?.country;
      const taxCountry = shippingCountry || billingCountry || 'غير محدد';

      const taxes = await Promise.all(s.total_details.breakdown.taxes.map(async (t) => {
        let taxRate = null;
        if (t.tax_rate) {
          if (typeof t.tax_rate === 'string') {
            taxRate = await stripe.taxRates.retrieve(t.tax_rate);
          } else {
            taxRate = t.tax_rate;
          }
        }
        
        return {
          amount: t.amount / 100,
          rate_percentage: taxRate?.percentage || 0,
          tax_type: taxRate?.description || 'ضريبة عامة',
          tax_id: taxRate?.id || 'N/A',
          jurisdiction: taxRate?.jurisdiction || taxCountry,
          country: taxRate?.country || taxCountry
        };
      }));

      const subtotal = s.amount_subtotal / 100;
      const taxTotal = taxes.reduce((sum, tax) => sum + tax.amount, 0);
      const grandTotal = s.amount_total / 100;

      return {
        transaction_id: s.id,
        date: new Date(s.created * 1000).toISOString(),
        customer: {
          email: s.customer_email,
          type: s.customer_details?.name ? 'شركة' : 'فرد',
        },
        amount_details: {
          subtotal: subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          currency: s.currency.toUpperCase()
        },
        tax_details: taxes,
        location: {
          country: taxCountry,
          region: s.shipping_details?.address?.state || 
                 s.payment_intent?.payment_method?.billing_details?.address?.state || 'N/A',
          city: s.shipping_details?.address?.city || 
                s.payment_intent?.payment_method?.billing_details?.address?.city || 'N/A'
        },
        payment_method: s.payment_intent?.payment_method?.type || 'unknown',
        status: s.payment_status === 'paid' ? 'مسددة' : 'معلقة'
      };
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching tax data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
app.get('/checkout-sessions-taxes2', async (req, res) => {
  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'complete',
      expand: ['data.total_details.breakdown.taxes', 'data.payment_intent.payment_method'] // تم التوسيع هنا
    });

    const sessionsWithTaxes = sessions.data.filter(s => 
      s.total_details?.breakdown?.taxes?.length > 0
    );

    res.json({
      success: true,
      data: sessionsWithTaxes.map(s => {
        // الحصول على تفاصيل الموقع من عنوان الشحن أو طريقة الدفع
        const shippingCountry = s.shipping_details?.address?.country;
        const billingCountry = s.payment_intent?.payment_method?.billing_details?.address?.country;
        const taxCountry = shippingCountry || billingCountry || 'غير محدد';

        return {
          // id: s.id,
          amount_total: s.amount_total / 100,
          currency: s.currency,
          location: {
            country: taxCountry,
            shipping_city: s.shipping_details?.address?.city,
            billing_city: s.payment_intent?.payment_method?.billing_details?.address?.city
          },
          // taxes: s.total_details.breakdown.taxes.map(t => ({
          //   amount: t.amount / 100,
          //   // rate_percentage: t.tax_rate?.percentage || 0,
          //   tax_type: t.tax_rate?.description || 'ضريبة عامة',
          //   // jurisdiction: t.tax_rate?.jurisdiction || taxCountry, // الولاية/المحافظة
          //   tax_rate_id: t.tax_rate?.id
          // })),
          customer_email: s.customer_email,
          created: new Date(s.created * 1000).toISOString()
        };
      })
    });
  } catch (error) {
    console.error('Error fetching tax data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
app.get('/invoice-taxes', async (req, res) => {
  try {
    const invoices = await stripe.invoices.list({
      limit: 100,
      expand: ['data.total_tax_amounts.tax_rate']
    });

    res.json({
      success: true,
      data: invoices.data.map(i => ({
        id: i.id,
        amount_paid: i.amount_paid / 100,
        tax: i.tax / 100,
        tax_details: i.total_tax_amounts?.map(t => ({
          amount: t.amount / 100,
          rate: t.tax_rate?.percentage || 0,
          country: t.tax_rate?.country
        })) || []
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/payment-taxes', async (req, res) => {
  try {
    const payments = await stripe.paymentIntents.list({
      limit: 100,
      expand: ['data.charges.data.balance_transaction.tax']
    });

    res.json({
      success: true,
      data: payments.data.filter(p => p.charges.data[0]?.balance_transaction?.tax)
        .map(p => ({
          id: p.id,
          amount: p.amount / 100,
          tax: p.charges.data[0].balance_transaction.tax / 100,
          currency: p.currency
        }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/complate',async(req,res)=>{
    try{
      await  paypal.capturpayment(req.query.token)
     res.send('secessful')

    }catch(error){
        res.send('error : '+error)
    }
})
app.get('/cancel',(rez,res)=>{
    res.redirect('/')
    })
app.listen(port,(req,res)=>{console.log(`that is server ${port}`);});
