import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
console.log("Current Directory:", process.cwd());

console.log("ENV TEST:", process.env.MONGO_URI);

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

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
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const projectSubmissionSchema = new mongoose.Schema(
  {
    projectName: String,
    country: String,
    projectType: String,
    credits: String,
    description: String,
  },
  { timestamps: true }
);

const ProjectSubmission = mongoose.model(
  "ProjectSubmission",
  projectSubmissionSchema
);
app.post("/api/project-submission", async (req, res) => {
  try {
    const { projectName, country, projectType, credits, description } = req.body;

    const submission = await ProjectSubmission.create({
      projectName,
      country,
      projectType,
      credits,
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