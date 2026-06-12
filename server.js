import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true, // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

function requireAdmin(req, res, next) {
  const adminKey = req.headers["x-admin-key"];

  if (adminKey !== process.env.ADMIN_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
    });
  }

  next();
}

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
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
