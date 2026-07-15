import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { authenticateToken, requireAdminRole } from "./middleware/auth.js";
import { PLANS, getPlan } from "./config/plans.js";
import { runGreenIntelligence, analyzeProjectForAI, compareMarkets } from "./services/greenAI.js";
import {
  ensureAiUsagePeriod,
  getAiQuota,
  consumeAiQuery,
  getEffectiveAiPlan,
} from "./services/usage.js";
dotenv.config();

const SITE_URL = (
  process.env.SITE_URL || "https://www.carbonaxisexchange.com"
).replace(/\/$/, "");

function passwordMeetsRules(password = "") {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  );
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true, // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import("stripe")).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (err) {
  console.warn("Stripe module not loaded:", err.message);
}

const app = express();

app.use(cors());

/** Stripe webhook needs raw body — register before json parser */
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Stripe webhook not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && PLANS[plan]) {
        await User.findByIdAndUpdate(userId, {
          subscription: plan,
          stripeCustomerId: session.customer || undefined,
          stripeSubscriptionId: session.subscription || undefined,
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await User.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        { subscription: "free", stripeSubscriptionId: "" }
      );
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).send("Webhook handler failed");
  }

  res.json({ received: true });
});

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

const requireAdmin = requireAdminRole;

const earlyAccessSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    role: String,
    message: String,
  },
  { timestamps: true }
);

const EarlyAccess = mongoose.model("EarlyAccess", earlyAccessSchema);

const projectSubmissionSchema = new mongoose.Schema(
  {
    projectName: String,
    country: String,
    projectType: String,
    credits: String,
    price: String,
    description: String,
    status: {
      type: String,
      default: "Pending",
    },
  },
  { timestamps: true }
);

const ProjectSubmission = mongoose.model(
  "ProjectSubmission",
  projectSubmissionSchema
);
const userSchema = new mongoose.Schema(
  {
    name: String,

    email: {
      type: String,
      unique: true,
    },

    password: String,

    company: String,

    country: String,
    phone: String,
jobTitle: String,
industry: String,
website: String,
linkedin: String,
bio: String,
profileImage: String,

    role: {
      type: String,
      default: "user",
    },

    subscription: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },

    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },

    aiUsage: {
      period: { type: String, default: "" },
      count: { type: Number, default: 0 },
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);
const carbonProjectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    projectName: String,
    projectType: String,
    country: String,
    organization: String,

    registry: String,
    methodology: String,
    vintageYear: String,
    estimatedCredits: String,

    askingPrice: String,
    currency: String,

    description: String,

    status: {
  type: String,
  enum: [
    "Draft",
    "Submitted",
    "Under Review",
    "Approved",
    "Published",
    "Rejected"
  ],
  default: "Draft"
},

    aiInsights: {
      opportunityScore: {
        type: Number,
        default: 0
      },
      riskScore: {
        type: Number,
        default: 0
      },
      marketReadiness: {
        type: Number,
        default: 0
      },
      timingSignal: {
        type: String,
        default: ""
      },
      aiSummary: {
        type: String,
        default: ""
      },
      policyFlags: {
        type: [String],
        default: []
      },
      recommendedMarkets: {
        type: [String],
        default: []
      },
      lastAnalyzed: Date
    }
  },
  { timestamps: true }
);

const CarbonProject = mongoose.model("CarbonProject", carbonProjectSchema);

const User = mongoose.model("User", userSchema);

const watchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    itemKey: { type: String, required: true },
    title: String,
    country: String,
    category: String,
    price: String,
    volume: String,
    source: { type: String, default: "marketplace" },
  },
  { timestamps: true }
);

watchlistSchema.index({ userId: 1, itemKey: 1 }, { unique: true });

const WatchlistItem = mongoose.model("WatchlistItem", watchlistSchema);

const aiQuerySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    question: String,
    country: String,
    product: String,
    answer: String,
    verdictHint: String,
    plan: String,
    provider: String,
  },
  { timestamps: true }
);

const AiQuery = mongoose.model("AiQuery", aiQuerySchema);

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    mode: { type: String, default: "" },
  },
  { timestamps: true }
);

const chatThreadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New chat",
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

chatThreadSchema.index({ userId: 1, updatedAt: -1 });

const ChatThread = mongoose.model("ChatThread", chatThreadSchema);

const dealSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listingKey: { type: String, required: true },
    listingTitle: { type: String, required: true },
    country: String,
    category: String,
    listedPrice: String,
    volumeRequested: { type: String, required: true },
    bidPrice: String,
    currency: { type: String, default: "USD" },
    message: String,
    contactEmail: String,
    contactName: String,
    status: {
      type: String,
      enum: [
        "Open",
        "Under Review",
        "Countered",
        "Accepted",
        "Rejected",
        "Closed",
      ],
      default: "Open",
    },
    adminNotes: { type: String, default: "" },
    counterPrice: String,
    counterVolume: String,
  },
  { timestamps: true }
);

const Deal = mongoose.model("Deal", dealSchema);

app.get("/", (req, res) => {
  res.send("CarbonAxis backend is running");
});

app.post("/api/early-access", async (req, res) => {
  try {
    const { name, email, role, message } = req.body;

    const submission = await EarlyAccess.create({
      name,
      email,
      role,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Early access request saved successfully",
      data: submission,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});
app.post("/api/projects", authenticateToken, async (req, res) => {
  try {
    const project = await CarbonProject.create({
      userId: req.user.id,
      ...req.body,
      status: req.body.status || "Draft"
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create project"
    });
  }
});
app.get("/api/projects", authenticateToken, async (req, res) => {
  try {
    const projects = await CarbonProject.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch projects"
    });
  }
  
});
app.get("/api/projects/:id", authenticateToken, async (req, res) => {
  try {
    const project = await CarbonProject.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    res.json({
      success: true,
      project
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load project"
    });
  }
});
// Update draft project
app.put("/api/projects/:id", authenticateToken, async (req, res) => {
  try {
    const project = await CarbonProject.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    if (project.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft projects can be edited"
      });
    }

    const allowedFields = [
      "projectName",
      "projectType",
      "country",
      "organization",
      "registry",
      "methodology",
      "vintageYear",
      "estimatedCredits",
      "askingPrice",
      "currency",
      "description"
    ];

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        project[field] = req.body[field];
      }
    });

    await project.save();

    return res.json({
      success: true,
      message: "Project updated successfully",
      project
    });

  } catch (error) {
    console.error("Update project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update project"
    });
  }
});


// Submit draft project for review
app.put("/api/projects/:id/submit", authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const project = await CarbonProject.findOne({
      _id: projectId,
      userId: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    if (project.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message: `Project is already ${project.status}`
      });
    }

    project.status = "Submitted";
    await project.save();

    return res.json({
      success: true,
      message: "Project submitted successfully",
      project
    });

  } catch (error) {
    console.error("Submit project error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit project"
    });
  }
});  
app.delete("/api/projects/:id", authenticateToken, async (req, res) => {

    try {

        const project = await CarbonProject.findOneAndDelete({

            _id: req.params.id,
            userId: req.user.id

        });

        if (!project) {

            return res.status(404).json({

                success:false,
                message:"Project not found"

            });

        }

        res.json({

            success:true,
            message:"Project deleted successfully"

        });

    } catch(error){

        console.error(error);

        res.status(500).json({

            success:false,
            message:"Unable to delete project"

        });

    }

});
app.post("/api/project-submission", async (req, res) => {
  try {
    const { projectName, country, projectType, credits, price, description } = req.body;

    const submission = await ProjectSubmission.create({
      projectName,
      country,
      projectType,
      credits,
      price,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Project submitted successfully",
      data: submission,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});
const brokerInquirySchema = new mongoose.Schema(
  {
    projectName: String,
    name: String,
    email: String,
    message: String,
  },
  { timestamps: true }
);

const BrokerInquiry = mongoose.model("BrokerInquiry", brokerInquirySchema);

app.get("/api/early-access", requireAdmin, async (req, res) => {
  try {
    const requests = await EarlyAccess.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch early access requests",
    });
  }
});

app.get("/api/project-submissions", requireAdmin, async (req, res) => {
  try {
    const projects = await ProjectSubmission.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch project submissions",
    });
  }
});
app.get("/api/approved-projects", async (req, res) => {
  try {

    const projects = await ProjectSubmission.find({
      status: "Approved"
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: projects
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "Failed to fetch approved projects"
    });

  }
});

app.patch("/api/project-submissions/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ["Pending", "Approved", "Rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const updatedProject = await ProjectSubmission.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json({
      success: true,
      message: "Project status updated",
      data: updatedProject,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Status update failed",
    });
  }
});

app.delete("/api/early-access/:id", requireAdmin, async (req, res) => {
  try {
    await EarlyAccess.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Early access request deleted",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});

app.delete("/api/project-submissions/:id", requireAdmin, async (req, res) => {
  try {
    await ProjectSubmission.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Project submission deleted",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});
app.post("/api/register", async (req, res) => {
  try {

    let {
  name,
  email,
  password,
  company,
  country
} = req.body;

email = email.toLowerCase().trim();
const passwordRules = {
  length: password.length >= 8,
  upper: /[A-Z]/.test(password),
  lower: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
};

if (
  !passwordRules.length ||
  !passwordRules.upper ||
  !passwordRules.lower ||
  !passwordRules.number ||
  !passwordRules.special
) {
  return res.status(400).json({
    success: false,
    message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
  });
}


    const existingUser = await User.findOne({
      email
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      company,
      country,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });

  }
});
app.post("/api/login", async (req, res) => {
  try {
    let { email, password } = req.body;

email = email.toLowerCase().trim();

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        country: user.country,
        role: user.role,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .toLowerCase()
      .trim();

    const okMessage =
      "If that email is registered, we sent a password reset link. Check your inbox.";

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email address.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: true, message: okMessage });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${SITE_URL}/reset-password.html?token=${rawToken}`;

    try {
      await transporter.sendMail({
        from: `"CarbonAxis Exchange" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Reset your CarbonAxis password",
        html: `
          <p>Hi ${user.name || "there"},</p>
          <p>We received a request to reset your CarbonAxis Exchange password.</p>
          <p><a href="${resetUrl}">Reset password</a></p>
          <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
        `,
      });
    } catch (mailErr) {
      console.error("Forgot password email failed:", mailErr.message);
      return res.status(500).json({
        success: false,
        message: "Could not send reset email. Try again shortly.",
      });
    }

    res.json({ success: true, message: okMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Password reset request failed",
    });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required.",
      });
    }

    if (!passwordMeetsRules(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8+ characters with upper, lower, number, and special character.",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or expired. Request a new one.",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = "";
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password updated. You can log in now.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
});

app.post("/api/change-password", authenticateToken, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required.",
      });
    }

    if (!passwordMeetsRules(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be 8+ characters with upper, lower, number, and special character.",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not change password",
    });
  }
});
app.post("/api/broker-inquiry", async (req, res) => {
  try {
    const { projectName, name, email, message } = req.body;

    const inquiry = await BrokerInquiry.create({
      projectName,
      name,
      email,
      message,
    });

    try {
      await transporter.sendMail({
        from: `"CarbonAxis Exchange" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: `New Broker Inquiry - ${projectName}`,
        html: `
          <h2>New Broker Inquiry</h2>
          <p><b>Project:</b> ${projectName}</p>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Message:</b></p>
          <p>${message}</p>
        `,
      });

      console.log("Broker inquiry email sent");
    } catch (emailError) {
      console.error("Broker email failed:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Broker inquiry submitted",
      data: inquiry,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Broker inquiry failed",
    });
  }
});
app.get("/api/broker-inquiries", requireAdmin, async (req, res) => {
  try {
    const inquiries = await BrokerInquiry.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: inquiries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch broker inquiries",
    });
  }
});

app.delete("/api/broker-inquiries/:id", requireAdmin, async (req, res) => {
  try {
    await BrokerInquiry.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Broker inquiry deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Broker inquiry delete failed",
    });
  }
});
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const totalProjects = await CarbonProject.countDocuments({
  userId: req.user.id
});

const approvedProjects = await CarbonProject.countDocuments({
  userId: req.user.id,
  status: "Approved"
});

    const watchCount = await WatchlistItem.countDocuments({
      userId: req.user.id,
    });

    await ensureAiUsagePeriod(user);
    const quota = getAiQuota(user);

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        company: user.company,
        country: user.country,
        role: user.role,
        subscription: user.subscription,
      },
      stats: {
        portfolioValue: 0,
        creditsWatched: watchCount,
        projectsSubmitted: totalProjects,
        verifiedProjects: approvedProjects,
        aiSearches: quota.used,
        aiLimit: quota.limit,
        aiRemaining: quota.remaining,
      },
      plan: getPlan(user.subscription),
      quota,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard"
    });
  }
});
app.get("/api/plans", (req, res) => {
  res.json({
    success: true,
    plans: Object.values(PLANS),
  });
});

app.get("/api/ai/quota", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await ensureAiUsagePeriod(user);
    res.json({ success: true, quota: getAiQuota(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load AI quota" });
  }
});

/** Private GPT-style threads — only the owner can read/write/delete */
app.get("/api/ai/threads", authenticateToken, async (req, res) => {
  try {
    const threads = await ChatThread.find({ userId: req.user.id })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ success: true, threads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load chats" });
  }
});

app.post("/api/ai/threads", authenticateToken, async (req, res) => {
  try {
    const title = String(req.body?.title || "New chat").slice(0, 80);
    const thread = await ChatThread.create({
      userId: req.user.id,
      title,
      messages: [],
    });
    res.status(201).json({ success: true, thread });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create chat" });
  }
});

app.get("/api/ai/threads/:id", authenticateToken, async (req, res) => {
  try {
    const thread = await ChatThread.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!thread) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    res.json({ success: true, thread });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load chat" });
  }
});

app.patch("/api/ai/threads/:id", authenticateToken, async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim().slice(0, 80);
    if (!title) {
      return res.status(400).json({ success: false, message: "Title required" });
    }
    const thread = await ChatThread.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title },
      { new: true }
    ).select("title createdAt updatedAt");
    if (!thread) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    res.json({ success: true, thread });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to rename chat" });
  }
});

app.delete("/api/ai/threads/:id", authenticateToken, async (req, res) => {
  try {
    const deleted = await ChatThread.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    res.json({ success: true, message: "Chat deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete chat" });
  }
});

app.post("/api/ai/ask", authenticateToken, async (req, res) => {
  try {
    const {
      question,
      country = "",
      product = "",
      conversation = [],
      threadId = null,
    } = req.body;

    if (!question || String(question).trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please enter a question.",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let thread = null;
    if (threadId) {
      thread = await ChatThread.findOne({
        _id: threadId,
        userId: req.user.id,
      });
      if (!thread) {
        return res.status(404).json({
          success: false,
          message: "Chat thread not found",
        });
      }
    } else {
      thread = await ChatThread.create({
        userId: user._id,
        title: String(question).trim().slice(0, 60),
        messages: [],
      });
    }

    const usage = await consumeAiQuery(user);
    if (!usage.allowed) {
      return res.status(402).json({
        success: false,
        message: usage.message,
        quota: usage.quota,
        upgradeUrl: "/pricing.html",
      });
    }

    const history =
      Array.isArray(conversation) && conversation.length
        ? conversation
        : thread.messages.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          }));

    const aiPlan = getEffectiveAiPlan(user);
    const result = await runGreenIntelligence({
      question: String(question).trim(),
      country: String(country || "").trim(),
      product: String(product || "").trim(),
      subscription: aiPlan.id,
      conversation: history,
    });

    const verdictMatch = result.answer.match(
      /\b(PROCEED_SHORT_TERM|PROCEED|CAUTION|AVOID|LONG_TERM|SHORT_TERM|MIXED)\b/i
    );

    await AiQuery.create({
      userId: user._id,
      question,
      country,
      product,
      answer: result.answer,
      verdictHint: verdictMatch ? verdictMatch[1].toUpperCase() : "",
      plan: aiPlan.id,
      provider: result.provider,
    });

    thread.messages.push({
      role: "user",
      content: String(question).trim(),
    });
    thread.messages.push({
      role: "assistant",
      content: result.answer,
      mode: result.mode || "",
    });
    if (thread.title === "New chat") {
      thread.title = String(question).trim().slice(0, 60);
    }
    await thread.save();

    res.json({
      success: true,
      answer: result.answer,
      provider: result.provider,
      deepAnalysis: result.deepAnalysis,
      mode: result.mode || "general",
      quota: usage.quota,
      focusMarkets: aiPlan.marketsPriority,
      threadId: thread._id,
      threadTitle: thread.title,
    });
  } catch (error) {
    console.error("AI ask error:", error);
    res.status(500).json({
      success: false,
      message: "CarbonAxis AI temporarily unavailable. Try again shortly.",
    });
  }
});

app.post("/api/ai/compare", authenticateToken, async (req, res) => {
  try {
    const {
      countryA = "",
      countryB = "",
      product = "",
      note = "",
      threadId = null,
    } = req.body;

    const a = String(countryA).trim();
    const b = String(countryB).trim();
    if (!a || !b) {
      return res.status(400).json({
        success: false,
        message: "Select two markets to compare.",
      });
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Choose two different markets.",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const usage = await consumeAiQuery(user);
    if (!usage.allowed) {
      return res.status(402).json({
        success: false,
        message: usage.message,
        quota: usage.quota,
        upgradeUrl: "/pricing.html",
      });
    }

    const aiPlan = getEffectiveAiPlan(user);
    const result = await compareMarkets({
      countryA: a,
      countryB: b,
      product: String(product || "").trim(),
      note: String(note || "").trim(),
      subscription: aiPlan.id,
    });

    const title = `Compare: ${a} vs ${b}`.slice(0, 60);
    let thread = null;
    if (threadId) {
      thread = await ChatThread.findOne({
        _id: threadId,
        userId: req.user.id,
      });
    }
    if (!thread) {
      thread = await ChatThread.create({
        userId: user._id,
        title,
        messages: [],
      });
    }

    const userLine = `Compare markets: ${a} vs ${b}${
      product ? ` · focus: ${product}` : ""
    }${note ? ` · note: ${note}` : ""}`;

    thread.messages.push({ role: "user", content: userLine });
    thread.messages.push({
      role: "assistant",
      content: result.answer,
      mode: "compare",
    });
    if (thread.title === "New chat") thread.title = title;
    await thread.save();

    await AiQuery.create({
      userId: user._id,
      question: userLine,
      country: `${a} vs ${b}`,
      product: String(product || "").trim(),
      answer: result.answer,
      verdictHint: "",
      plan: aiPlan.id,
      provider: result.provider,
    });

    res.json({
      success: true,
      answer: result.answer,
      provider: result.provider,
      deepAnalysis: result.deepAnalysis,
      mode: "compare",
      quota: usage.quota,
      focusMarkets: aiPlan.marketsPriority,
      threadId: thread._id,
      threadTitle: thread.title,
      countryA: a,
      countryB: b,
    });
  } catch (error) {
    console.error("AI compare error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Market compare temporarily unavailable.",
    });
  }
});

app.post("/api/projects/:id/analyze", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const plan = getEffectiveAiPlan(user);
    if (!plan.projectAiInsights) {
      return res.status(402).json({
        success: false,
        message: "Project AI insights require Pro or Enterprise. Upgrade to unlock.",
        upgradeUrl: "/pricing.html",
      });
    }

    const project = await CarbonProject.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const usage = await consumeAiQuery(user);
    if (!usage.allowed) {
      return res.status(402).json({
        success: false,
        message: usage.message,
        quota: usage.quota,
        upgradeUrl: "/pricing.html",
      });
    }

    const insights = await analyzeProjectForAI(project, plan.id);
    project.aiInsights = insights;
    await project.save();

    res.json({
      success: true,
      aiInsights: project.aiInsights,
      quota: usage.quota,
    });
  } catch (error) {
    console.error("Project analyze error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze project",
    });
  }
});

app.get("/api/watchlist", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await WatchlistItem.find({ userId }).sort({
      createdAt: -1,
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load watchlist" });
  }
});

app.post("/api/watchlist", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const plan = getPlan(user.subscription);
    const count = await WatchlistItem.countDocuments({ userId: user._id });

    const { itemKey, title, country, category, price, volume, source } = req.body;
    if (!itemKey || !title) {
      return res.status(400).json({
        success: false,
        message: "itemKey and title are required",
      });
    }

    const existing = await WatchlistItem.findOne({
      userId: user._id,
      itemKey: String(itemKey),
    });

    if (!existing && count >= plan.maxWatchlist) {
      return res.status(402).json({
        success: false,
        message: `Watchlist limit reached for ${plan.name} (${plan.maxWatchlist}). Upgrade for more.`,
        upgradeUrl: "/pricing.html",
      });
    }

    const item = await WatchlistItem.findOneAndUpdate(
      { userId: user._id, itemKey: String(itemKey) },
      {
        userId: user._id,
        itemKey: String(itemKey),
        title,
        country,
        category,
        price,
        volume,
        source: source || "marketplace",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to save watchlist item" });
  }
});

app.delete("/api/watchlist/:itemKey", authenticateToken, async (req, res) => {
  try {
    let itemKey = req.params.itemKey || "";
    try {
      itemKey = decodeURIComponent(itemKey);
    } catch (_) {}

    const deleted = await WatchlistItem.findOneAndDelete({
      userId: req.user.id,
      itemKey,
    });
    res.json({
      success: true,
      message: deleted ? "Removed from watchlist" : "Item already removed",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to remove watchlist item" });
  }
});

/**
 * Temporary plan switcher for MVP until payment gateway is connected.
 * Admin/dev can enable via ALLOW_PLAN_SELF_SERVE=true
 */
app.post("/api/subscription/set", authenticateToken, async (req, res) => {
  try {
    if (process.env.ALLOW_PLAN_SELF_SERVE !== "true") {
      return res.status(403).json({
        success: false,
        message: "Self-serve plan changes disabled. Contact CarbonAxis to upgrade.",
      });
    }

    const { plan } = req.body;
    if (!PLANS[plan]) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { subscription: plan },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: `Plan updated to ${PLANS[plan].name}`,
      user,
      plan: PLANS[plan],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update plan" });
  }
});

/** OTC deal / RFQ */
app.post("/api/deals", authenticateToken, async (req, res) => {
  try {
    const {
      listingKey,
      listingTitle,
      country,
      category,
      listedPrice,
      volumeRequested,
      bidPrice,
      currency,
      message,
      contactEmail,
      contactName,
    } = req.body;

    if (!listingKey || !listingTitle || !volumeRequested) {
      return res.status(400).json({
        success: false,
        message: "listingKey, listingTitle and volumeRequested are required",
      });
    }

    const deal = await Deal.create({
      buyerId: req.user.id,
      listingKey,
      listingTitle,
      country,
      category,
      listedPrice,
      volumeRequested,
      bidPrice,
      currency: currency || "USD",
      message,
      contactEmail: contactEmail || req.user.email,
      contactName,
      status: "Open",
    });

    try {
      if (process.env.EMAIL_USER) {
        await transporter.sendMail({
          from: `"CarbonAxis Exchange" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER,
          subject: `New OTC Deal Request - ${listingTitle}`,
          html: `
            <h2>New OTC / RFQ Request</h2>
            <p><b>Listing:</b> ${listingTitle}</p>
            <p><b>Volume:</b> ${volumeRequested}</p>
            <p><b>Bid:</b> ${bidPrice || "-"}</p>
            <p><b>Buyer email:</b> ${contactEmail || req.user.email}</p>
            <p><b>Message:</b> ${message || "-"}</p>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Deal email failed:", emailErr);
    }

    res.status(201).json({
      success: true,
      message: "Deal request submitted. CarbonAxis will review shortly.",
      deal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create deal" });
  }
});

app.get("/api/deals", authenticateToken, async (req, res) => {
  try {
    const deals = await Deal.find({ buyerId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, deals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load deals" });
  }
});

app.get("/api/deals/all", requireAdmin, async (req, res) => {
  try {
    const deals = await Deal.find()
      .populate("buyerId", "name email company country subscription")
      .sort({ createdAt: -1 });
    res.json({ success: true, deals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load all deals" });
  }
});

app.patch("/api/deals/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status, adminNotes, counterPrice, counterVolume } = req.body;
    const allowed = [
      "Open",
      "Under Review",
      "Countered",
      "Accepted",
      "Rejected",
      "Closed",
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const deal = await Deal.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNotes: adminNotes || "",
        counterPrice,
        counterVolume,
      },
      { new: true }
    );

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    res.json({ success: true, deal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update deal" });
  }
});

/** Stripe Checkout for Pro / Enterprise */
app.post("/api/billing/checkout", authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message:
          "Stripe is not configured yet. Add STRIPE_SECRET_KEY on the server, or request an upgrade manually.",
      });
    }

    const { plan } = req.body;
    if (!["pro", "enterprise"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Only pro or enterprise can be purchased.",
      });
    }

    const priceId =
      plan === "pro"
        ? process.env.STRIPE_PRICE_PRO
        : process.env.STRIPE_PRICE_ENTERPRISE;

    if (!priceId) {
      return res.status(503).json({
        success: false,
        message: `Missing Stripe price id for ${plan}. Set STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE.`,
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const siteUrl = process.env.SITE_URL || "https://www.carbonaxisexchange.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard.html?billing=success&plan=${plan}`,
      cancel_url: `${siteUrl}/pricing.html?billing=cancel`,
      metadata: {
        userId: String(user._id),
        plan,
      },
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to start checkout",
    });
  }
});

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
});

app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      company,
      country,
      phone,
      jobTitle,
      industry,
      website,
      linkedin,
      bio,
      profileImage,
    } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        company,
        country,
        phone,
        jobTitle,
        industry,
        website,
        linkedin,
        bio,
        profileImage,
      },
      {
        new: true,
      }
    ).select("-password");

    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
