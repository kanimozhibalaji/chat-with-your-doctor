import mongoose from "mongoose";

const connectDB = async () => {

    mongoose.connection.on('connected', () => console.log("Database Connected"))
    const dbName = process.env.MONGODB_DB_NAME || 'prescripto';
    const uri = process.env.MONGODB_URI.replace(/\/$/, '') + '/' + dbName;
    await mongoose.connect(uri)

}

export default connectDB;

// Do not use '@' symbol in your databse user's password else it will show an error.