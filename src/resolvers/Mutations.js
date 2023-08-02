import { generateOtp, generateTransactionId } from "../util/otp.js";
import { verifyOTP } from "../util/otp.js";

import password_1 from "@accounts/password";
import server_1 from "@accounts/server";

export default {
  async sendOTP(parent, args, context, info) {
    console.log("sending otp console");
    const { collections } = context;
    const { users } = collections;

    console.log("sendOTP");
    let msisdn;
    if (args.phone && args.phone.length > 10 && args.phone[0] == "+") {
      msisdn = args.phone;
    } else if (args.email) {
      const userExist = await users.findOne({
        "emails.0.address": args?.email,
      });
      if (!userExist) {
        throw new Error("User does not exist");
      }
      msisdn = userExist.phone;
    } else {
      throw Error("Invalid phone number");
    }

    const res = await generateOtp(msisdn);
    console.log("res", res);
    return res;
  },
  async checkUserExist(parent, args, context, info) {
    const { collections } = context;
    const { users, InvitedUsers } = collections;
    const email = args.email;
    const phone = args.phone;
    const registerToken = args.registerToken;

    const invitedStatus = await InvitedUsers.findOne({
      email: email.toLowerCase(),
    });

    if (!invitedStatus) {
      return new Error(
        "You have not been invited to register with this platform"
      );
    }

    if (invitedStatus?.registerToken !== registerToken) {
      return new Error(
        "Registration Link is not valid, please check your email and follow the instructions. If you are unable to register, please request a new invitation link"
      );
    }

    const currentDate = new Date();
    const expiryDate = new Date(invitedStatus.expirationTime);

    if (expiryDate < currentDate) {
      return new Error("Your invitation has expired");
    }

    await InvitedUsers.updateOne(
      { email: email.toLowerCase() },
      { $set: { isRegistered: true } }
    );

    let userExist = await users.findOne({ phone: phone });
    if (!userExist) {
      userExist = await users.findOne({ "emails.0.address": email });
    }

    console.log("userExist");
    console.log(userExist);

    if (userExist !== null) {
      return true;
    } else {
      return false;
    }
  },
  verifyOTP(parent, args, context, info) {
    return verifyOTP(args.phone, args.otp, context);
  },
  resetPassword: async (_, { token, newPassword }, { injector, infos }) => {
    return injector
      .get(password_1.AccountsPassword)
      .resetPassword(token, newPassword, infos);
  },

  sendResetPasswordEmail: async (_, { email }, { injector }) => {
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    try {
      await accountsPassword.sendResetPasswordEmail(email);
    } catch (error) {
      // If ambiguousErrorMessages is true,
      // to prevent user enumeration we fail silently in case there is no user attached to this email
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof server_1.AccountsJsError &&
        error.code === password_1.SendResetPasswordEmailErrors.UserNotFound
      ) {
        return null;
      }
      throw error;
    }
    return null;
  },
  async createUser(_, { user }, ctx) {
    const { injector, infos, collections } = ctx;
    // const { Accounts } = collections;
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    let userId;

    try {
      userId = await accountsPassword.createUser(user);
    } catch (error) {
      // If ambiguousErrorMessages is true we obfuscate the email or username already exist error
      // to prevent user enumeration during user creation
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof server_1.AccountsJsError &&
        (error.code === password_1.CreateUserErrors.EmailAlreadyExists ||
          error.code === password_1.CreateUserErrors.UsernameAlreadyExists)
      ) {
        return {};
      }
      throw error;
    }
    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages ? null : userId,
      };
    }

    if (userId) {
      const account = {
        _id: userId,
        acceptsMarketing: false,
        emails: [
          {
            address: user.email,
            verified: false,
            provides: "default",
          },
        ],
        groups: [GroupNameResp],
        name: null,
        profile: {
          firstName: user.firstName,
          lastName: user.lastName,
          dob: user.dob,
          phone: user.phone,
        },
        shopId: null,
        state: "new",
        userId: userId,
        UserRole: user.UserRole,
      };
      // const accountAdded = await Accounts.insertOne({
      //   _id: userId,
      //   firstName: user.firstName,
      //   lastName: user.lastName,
      //   name: user.firstName + " " + user.lastName,
      //   phone: user.phone,
      //   UserRole: user.UserRole
      // });
      const accountAdded = await Accounts.insertOne(account);
      // console.log(accountAdded)
    }
    // if (userId) {
    //         const accountAdded = await Accounts.insertOne({ _id: userId, firstName: user.firstName, lastName: user.lastName, name: user.firstName + " " + user.lastName, phone: user.phone })

    // }
    // When initializing AccountsServer we check that enableAutologin and ambiguousErrorMessages options
    // are not enabled at the same time
    const createdUser = await accountsServer.findUserById(userId);
    // If we are here - user must be created successfully
    // Explicitly saying this to Typescript compiler
    const loginResult = await accountsServer.loginWithUser(createdUser, infos);
    await generateOtp(user.phone);
    return {
      userId,
      // loginResult,
    };
  },
  changePassword: async (
    _,
    { oldPassword, newPassword },
    { user, injector }
  ) => {
    if (!(user && user.id)) {
      throw new Error("Unauthorized");
    }
    const userId = user.id;
    await injector
      .get(password_1.AccountsPassword)
      .changePassword(userId, oldPassword, newPassword);
    return null;
  },
  async createUserWithOtp(_, { user }, ctx) {
    const { injector, infos, collections } = ctx;

    console.log("injector is ", injector);
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    const { Accounts, users } = collections;
    let result = "";
    const characters = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const charactersLength = characters.length;

    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    let userId;

    try {
      userId = await accountsPassword.createUser(user);
    } catch (error) {
      // If ambiguousErrorMessages is true we obfuscate the email or username already exist error
      // to prevent user enumeration during user creation
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof server_1.AccountsJsError &&
        (error.code === password_1.CreateUserErrors.EmailAlreadyExists ||
          error.code === password_1.CreateUserErrors.UsernameAlreadyExists)
      ) {
        return {};
      }
      throw error;
    }
    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages ? null : userId,
      };
    }

    const adminCount = await Accounts.findOne({
      _id: userId,
    });
    console.log("adminCount", adminCount);
    if (userId) {
      console.log("user", user);
      const account = {
        _id: userId,
        transactionId: `ID${result}`,
        acceptsMarketing: false,
        emails: [
          {
            address: user.email,
            verified: false,
            provides: "default",
          },
        ],
        groups: [],
        name: null,
        profile: {
          firstName: user.firstName,
          lastName: user.lastName,
          dob: user.dob,
          phone: user.phone,
          transactionId: `ID${result}`,
          picture:
            "public/user/cmVhY3Rpb24vYWNjb3VudDo2NDNlM2U3ZjVmOWNhOGRjYTI5Nzg1NGI=/profile_picture/medium-1684814447798-default.jpg",
        },
        shopId: null,
        state: "new",
        userId: userId,
        identityVerified: false,
        isBanned: false,
        wallets: {
          amount: 0,
          escrow: 0,
          currency: "naira",
        },
      };
      const accountAdded = await Accounts.insertOne(account);

      console.log("addedd acount is ");
      console.log(accountAdded);
    }
    // When initializing AccountsServer we check that enableAutologin and ambiguousErrorMessages options
    // are not enabled at the same time
    const createdUser = await accountsServer.findUserById(userId);
    // If we are here - user must be created successfully
    // Explicitly saying this to Typescript compiler
    const loginResult = await accountsServer.loginWithUser(createdUser, infos);
    await generateOtp(user.phone);
    return {
      userId,
      // loginResult,
    };
  },
  authenticate: async (_, args, ctx) => {
    const { serviceName, params } = args;
    const { injector, infos, collections } = ctx;
    const { users } = collections;
    console.log("authenticate");
    const authenticated = await injector
      .get(server_1.AccountsServer)
      .loginWithService(serviceName, params, infos);
    return authenticated;
  },
  authenticateWithOTP: async (_, args, ctx) => {
    const { serviceName, params } = args;
    const { injector, infos, collections } = ctx;
    const { users } = collections;
    const userExist = await users.findOne({
      "emails.0.address": params?.user?.email,
    });
    console.log("user exist is ", userExist);
    const resOTP = await verifyOTP(userExist.phone, params.code, ctx);

    // console.log(userExist)
    // if (userExist.phoneVerified) {
    //         const authenticated = await injector
    //                 .get(server_1.AccountsServer)
    //                 .loginWithService(serviceName, params, infos);
    //         return authenticated;
    // }
    // else
    if (!resOTP?.status) {
      return null;
    } else {
      const authenticated = await injector
        .get(server_1.AccountsServer)
        .loginWithService(serviceName, params, infos);
      console.log("authenticated", authenticated);
      return authenticated;
    }
  },
};
