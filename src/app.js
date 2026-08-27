import express from "express";
import cors from "cors";
import { inquiryCollection, projectCollection } from "./config/db.js";
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

//update Property
app.patch("/api/property/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { _id, ...updateData } = req.body;
    const result = await projectCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Property update successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update property error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update property",
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

//Inquiry section
//add inquiry — public, called from PropertyDetailsClient's handleFormSubmit
app.post("/api/inquiries", async (req, res) => {
  try {
    const { requestType, tourType, name, phone, email, message, property } =
      req.body;

    if (!requestType || !name || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: "requestType, name, phone and email are required",
      });
    }

    const inquiryData = {
      requestType,
      tourType: requestType === "SCHEDULE_TOUR" ? tourType || null : null,
      name,
      phone,
      email,
      message: message || "",
      property: {
        id: property?.id || null,
        slug: property?.slug || null,
        title: property?.title || null,
        coverImage: property?.coverImage || null,
      },
      status: "NEW",
      assignedTo: null,
      internalNotes: [],
      isRead: false,
      source: req.body.source || "property_page",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await inquiryCollection.insertOne(inquiryData);

    res.status(201).json({
      success: true,
      message: "Inquiry submitted successfully",
      data: { _id: result.insertedId, ...inquiryData },
    });
  } catch (error) {
    console.error("Create inquiry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit inquiry",
      error: error.message,
    });
  }
});

// small helper — turns "-createdAt" into { createdAt: -1 }, "name" into { name: 1 }
function parseSort(sortParam = "-createdAt") {
  const field = sortParam.replace(/^-/, "");
  const direction = sortParam.startsWith("-") ? -1 : 1;
  return { [field]: direction };
}

//get inquiry stats — must come before "/api/admin/inquiries/:id" so
//"stats" isn't matched as an :id
app.get("/api/admin/inquiries/stats", async (req, res) => {
  try {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [total, unread, thisWeek, converted, closedLost] = await Promise.all([
      inquiryCollection.countDocuments({}),
      inquiryCollection.countDocuments({ isRead: false }),
      inquiryCollection.countDocuments({
        createdAt: { $gte: startOfWeek },
      }),
      inquiryCollection.countDocuments({ status: "CONVERTED" }),
      inquiryCollection.countDocuments({ status: "CLOSED_LOST" }),
    ]);

    const decided = converted + closedLost;
    const conversionRate = decided > 0 ? (converted / decided) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        unread,
        thisWeek,
        converted,
        conversionRate: Math.round(conversionRate * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Get inquiry stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
});

//bulk update status — must come before "/api/admin/inquiries/:id" (PATCH)
app.patch("/api/admin/inquiries/bulk", async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({
        success: false,
        message: "ids[] and status are required",
      });
    }

    const result = await inquiryCollection.updateMany(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { $set: { status, updatedAt: new Date() } },
    );

    res.status(200).json({
      success: true,
      message: "Inquiries updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update inquiries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inquiries",
      error: error.message,
    });
  }
});

//bulk delete — must come before "/api/admin/inquiries/:id" (DELETE)
app.delete("/api/admin/inquiries/bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids[] is required" });
    }

    const result = await inquiryCollection.deleteMany({
      _id: { $in: ids.map((id) => new ObjectId(id)) },
    });

    res.status(200).json({
      success: true,
      message: "Inquiries deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Bulk delete inquiries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inquiries",
      error: error.message,
    });
  }
});

//get inquiries — list with filter, search, pagination
app.get("/api/admin/inquiries", async (req, res) => {
  try {
    const {
      status,
      requestType,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "property.title": { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      inquiryCollection
        .find(filter)
        .sort(parseSort(sort))
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      inquiryCollection.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get inquiries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inquiries",
      error: error.message,
    });
  }
});

//get inquiry by id — also marks it as read
app.get("/api/admin/inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await inquiryCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { isRead: true } },
      { returnDocument: "after" },
    );

    const inquiry = result?.value || result; // driver-version safe
    if (!inquiry) {
      return res
        .status(404)
        .json({ success: false, message: "Inquiry not found" });
    }

    res.status(200).json({ success: true, data: inquiry });
  } catch (error) {
    console.error("Get inquiry by id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inquiry",
      error: error.message,
    });
  }
});

//update inquiry — status and/or assignedTo
app.patch("/api/admin/inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;

    const updateData = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;

    const result = await inquiryCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" },
    );

    const inquiry = result?.value || result;
    if (!inquiry) {
      return res
        .status(404)
        .json({ success: false, message: "Inquiry not found" });
    }

    res.status(200).json({
      success: true,
      message: "Inquiry updated successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("Update inquiry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inquiry",
      error: error.message,
    });
  }
});

//add internal note to inquiry
app.post("/api/admin/inquiries/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Note text is required" });
    }

    const note = {
      _id: new ObjectId(),
      text: text.trim(),
      addedBy: req.body.addedBy || "Admin", // wire up once you add admin auth
      addedAt: new Date(),
    };

    const result = await inquiryCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $push: { internalNotes: note }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    const inquiry = result?.value || result;
    if (!inquiry) {
      return res
        .status(404)
        .json({ success: false, message: "Inquiry not found" });
    }

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("Add inquiry note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: error.message,
    });
  }
});

//delete inquiry by id
app.delete("/api/admin/inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await inquiryCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Inquiry not found" });
    }

    res.status(200).json({
      success: true,
      message: "Inquiry deleted successfully",
    });
  } catch (error) {
    console.error("Delete inquiry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inquiry",
      error: error.message,
    });
  }
});

export default app;
