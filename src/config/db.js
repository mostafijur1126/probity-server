import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

export const db = client.db("real-estate");
export const projectCollection = db.collection("projects");

export async function connectDB() {
  await client.connect();
  console.log("MongoDB Connected");
}

export default client;
