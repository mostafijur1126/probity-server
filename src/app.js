import express from "express";
import cors from "cors";
import { projectCollection } from "./config/db.js";
import { ObjectId } from "mongodb";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server Running...");
});

//Property section
//add property
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

//get Property
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

//get Property by slug
app.get("/api/property/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const property = await projectCollection.findOne({ slug });
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("Get property by slug error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch property",
      error: error.message,
    });
  }
});

//delete property by id
app.delete("/api/property/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleteProperty = await projectCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (!deleteProperty) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Property delete successfully",
      data: deleteProperty,
    });
  } catch (error) {
    console.error("Delete property error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete property",
      error: error.message,
    });
  }
});

export default app;
