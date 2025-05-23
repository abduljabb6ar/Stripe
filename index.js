require("dotenv").config();
// const cors = require('cors');
var express=require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe=require('stripe')(process.env.STRIPE_SECRIT)
const port=8000||process.env.PORT;
var app=express();
const crypto = require('crypto');
app.use(cors({
  origin: ["https://www.ghidhaalruwhusa.com", "https://ghidhaalruwhusa.com"]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.set('view engine','ejs');
app.get('/',(req,res)=>{
    res.render("index.ejs")
})
// app.post('/checkout', async (req, res) => {
//   const {  amount,currency, customerId, email, line1,line2,city,state,postalCode,country } = req.body;
//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: amount, // المبلغ بالدولار أو أي عملة أخرى
//       currency: currency, // العملة
//       metadata: {
//         firebaseUserId: customerId, // معرف المستخدم في Firebase
//       },
//       receipt_email: email, // البريد الإلكتروني
//       shipping: {
//         name: 'Customer Name',
//         address: {
//           line1: line1,
//           line2: line2,
//           city: city,
//           state: state,
//           postal_code: postalCode,
//           country: country,
//         },
//       },
//     });
//     res.json({ clientSecret: paymentIntent.client_secret });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });
function encrypt(data, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
  let encrypted = cipher.update(data, 'utf8', 'hex'); // تأكد من أن data ليست undefined
  encrypted += cipher.final('hex');
  return encrypted;
  
}
// const iv = crypto.randomBytes(16)
// const encryptionKey = 'abduljabbarfuadamer1372001abdulj'; // تأكد أن المفتاح طوله 32 حرفًا
app.post('/checkout', async (req, res) => {
  try {
      const price = parseInt(req.body.price, 10);
      const itmename = req.body.itmename;
      const userId = req.body.userId; // معرف المستخدم من Firebase
      // const userEmail = req.body.userEmail; // البريد الإلكتروني
      const userEmail = req.body.userEmail; // البريد الإلكتروني
      const shippingAddress = req.body.shippingAddress; // عنوان الشحن
      // const token = req.body.token; // عنوان الشحن
      const password = req.body.password; // عنوان الشحن

// const encryptedEmail = encrypt(userEmail, encryptionKey,iv);
// const encryptedPassword = encrypt(password, encryptionKey,iv);
      const successUrl = `https://ghidhaalruwhusa.com/success?email=${encodeURIComponent(userEmail)}&password=${encodeURIComponent(password)}`;
      // // const line2 = req.body.line2; // عنوان الشحن
      // const city = req.body.city; // عنوان الشحن
      // const state = req.body.state; // عنوان الشحن
      // const postalCode = req.body.postalCode; // عنوان الشحن
      

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
        metadata: {
          productName:itmename,
          userId: userId, // تخزين معرف المستخدم في metadata
          shippingAddress:shippingAddress
        },
        // shipping: {
        //   name: 'Customer Name',
        //   address: {
        //     shipping_rates: line1,
        //     // line2: line2,
        //     city: city,
        //     state: state,
        //     postal_code: postalCode,
        //     country: country,
        //   },
        // },
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
      limit: 10
    });

    res.json({
      success: true,
      data: sessions.data.map(s => ({
        id: s.id,
        payment_status: s.payment_status,
        amount_total: s.amount_total / 100,
        customer_email: s.customer_email,
        created: new Date(s.created * 1000),
        url: s.url
      }))
    });
  } catch (error) {
    console.error('Error fetching checkout sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// app.post('/checkout', async (req, res) => {
//     try {
//         const price = parseInt(req.body.price,10);
//         const itmename = req.body.itmename;

//         const session = await stripe.checkout.sessions.create({
//           payment_method_types: ['card'],
//           line_items: [{
//             price_data: {
//               currency: 'usd',
//               product_data: {
                
//                 name: itmename,
//               },
//               unit_amount: price,
//             },
//             quantity: 1,
//           }],
//             mode: 'payment',
//             // ui_mode: 'embedded',
//             success_url: 'https://ghidhaalruwh.netlify.app',
//             cancel_url: 'https://ghidhaalruwh.netlify.app',
//         });
//       // res.redirect(session.url); // توجيه المستخدم إلى صفحة الدفع في Stripe
//        res.json({ url: session.url });

//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).send('Error occurred');
//     }
// });
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
