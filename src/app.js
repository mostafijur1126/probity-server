import express from "express";
import cors from "cors";
import { projectCollection } from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server Running...");
});

//Property section
app.post("/api/property", async (req, res) => {
  try {
    const projectData = req.body;
    const result = await projectCollection.insertOne(projectData);

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Faild to create project",
    });
  }
});

//Property get api
app.get("/api/property", async (req, res) => {
  try {
    const result = await projectCollection.find().toArray();

    res.status(200).json({
      success: true,
      message: "Properties fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Failed to fetch properties:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch properties",
      error: error.message,
    });
  }
});

export default app;
