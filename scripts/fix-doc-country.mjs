import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const id = process.argv[2] || "6a646202dd3bb233cd441f00";
const country = process.argv[3] || "Pakistan";

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI missing");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const docs = mongoose.connection.collection("knowledge_documents");
const chunks = mongoose.connection.collection("knowledge_chunks");
const objectId = new mongoose.Types.ObjectId(id);

const before = await docs.findOne(
  { _id: objectId },
  { projection: { title: 1, country: 1, status: 1 } }
);

console.log("BEFORE", JSON.stringify(before));

if (!before) {
  console.error("Document not found");
  await mongoose.disconnect();
  process.exit(1);
}

const docResult = await docs.updateOne(
  { _id: objectId },
  { $set: { country, updatedAt: new Date() } }
);

const chunkResult = await chunks.updateMany(
  { documentId: objectId },
  { $set: { country, updatedAt: new Date() } }
);

const after = await docs.findOne(
  { _id: objectId },
  { projection: { title: 1, country: 1, status: 1 } }
);

console.log("DOC_UPDATE", docResult.modifiedCount);
console.log("CHUNK_UPDATE", chunkResult.modifiedCount);
console.log("AFTER", JSON.stringify(after));

await mongoose.disconnect();
