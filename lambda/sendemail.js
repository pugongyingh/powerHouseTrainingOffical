module.exports.handler= function (event, context, callback) {
  const nodemailer = require('nodemailer');
const hbs=require('nodemailer-express-handlebars');
const smtpTransport = require('nodemailer-smtp-transport');
  const requestBody = JSON.parse(event.body);
  console.log("dvdvd",requestBody);
const receipent=requestBody.receipent;
const loggedInUser=requestBody.loggedInUser;
const createdData=requestBody.createdData;
const typeofOperation=requestBody.typeofOperation;
const category=requestBody.category;
  console.log("send email",receipent,loggedInUser,createdData,typeofOperation,category);
  const transporter = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    auth: {
      user: 'hsahu77588@gmail.com',
      pass: 'Hsahu77@123p'
    }
  }));
  
  transporter.use('compile',hbs({
    viewEngine: {
      extName: '.hbs',
      partialsDir: './src/views/',
      layoutsDir: './src/views/',
      defaultLayout: null,
    },
    viewPath:'./src/views/'
  }))
  const mailOptions = {
    from: 'hsahu77588@gmail.com',
    to: `${receipent}`,
    subject: `PowerHouse Training Yard has a created a NEW user`,
    template:loggedInUser!=null ? 'home': 'schedule',
    context:{
      loggedInUser:loggedInUser,createdData:createdData,typeofOperation:typeofOperation,category:category
    }

  };
  transporter.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});

}
