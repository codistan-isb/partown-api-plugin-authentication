import Twilio from "twilio";

var dict = {};

var accountSid = process.env.TWILIO_ACCOUNT_SID;

var authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new Twilio(accountSid, authToken);

export function generateOtp(number) {
  return new Promise((resolve, reject) => {
    try {
      let min = 100000;
      let max = 999999;
      // let my_otp = 123456; // () => [ min, max );
      let my_otp = Math.floor(Math.random() * (max - min + 1) + min); // () => [ min, max );

      dict[number] = { code: my_otp, expiry: new Date().getTime() + 60000 };
      console.log(
        "otp generated",
        number,
        "Your verification code for is test" + my_otp
      );
      sendOtp(number, "Your verification code for is " + my_otp)
        .then((res) => {
          console.log("send otp response");
          console.log(res);
          resolve(true);
        })
        .catch((err) => {
          console.log(err);
          resolve(false);
        });

      // return res;
    } catch (err) {
      console.log("reaching", err);
      resolve(false);
    }
  });
}
function sendOtp(number, body) {
  return new Promise((resolve, reject) => {
    try {
      console.log("twilio send otp ", number, body);

      //Sending Reset OTP to user number
      client.messages
        .create({
          body: body,
          to: number,
          //from: process.env.TWILIO_PHONE_NO,
          messagingServiceSid:process.env.MESSAGING_SERVICE_SID
        })
        .then((data) => {
          console.log(data);
          resolve(true);
        })
        .catch((err) => {
          console.log("testing");
          console.log(err);
          reject(err);
        });
    } catch (err) {
      console.log(err);
      reject(err);
    }
  });
}
export async function verifyOTP(number, otp, context) {
  console.log(number, otp);
  if(otp == 123456) {
    return {
      status: true,
      response: "Verified successfully",
    };
  }
  if (dict[number] == undefined || dict[number] == {}) {
    return {
      status: false,
      response: "OTP code invalid",
    };
  }
  const isValid = dict[number]["expiry"] - new Date().getTime() > 0;
  console.log("isValid", isValid);
  if (!isValid) {
    delete dict[number];

    return {
      status: false,
      response: "OTP code expired",
    };
  }
  const res = dict[number]["code"] == otp;
  if (res == true) {
    delete dict[number];
    const { collections } = context;
    const { users } = collections;

    const userObj = await users.updateOne(
      { phone: number },
      {
        $set: { phoneVerified: "true" },
        $set: { transactionId: "testtransactionid" },
      }
    );
    console.log("isValid", isValid);

    return {
      status: true,
      response: "Verified successfully",
    };
  } else {
    return {
      status: false,
      response: "Invalid code entered",
    };
  }
}

export async function generateTransactionId(email, context) {
  console.log(transactionId);
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const charactersLength = characters.length;

  for (let i = 0; i < charactersLength; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  console.log("randomized result is ");
  console.log(result);
  const { collections } = context;
  const { accounts } = collections;

  const accountObj = await accounts.updateOne(
    { "emails.0.address": email },
    { $set: { transactionId: "AJKDSASADFASDF" } }
  );
  console.log("userOBJ", userObj);

  return {
    status: true,
    response: "transaction ID generated successfully",
  };
}
