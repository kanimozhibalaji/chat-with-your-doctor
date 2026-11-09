import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import doctorModel from './models/doctorModel.js';

async function inspectDoc() {
    await mongoose.connect(process.env.MONGODB_URI);
    const doc = await doctorModel.findOne({ email: 'bharathraj16142@gmail.com' });
    console.log("Doctor found:", doc ? {
        _id: doc._id,
        name: doc.name,
        email: doc.email,
        passwordHash: doc.password ? doc.password.substring(0, 15) + '...' : 'NONE',
        isGoogleAuth: doc.isGoogleAuth
    } : "NOT FOUND");

    if (doc) {
        const testMatch = await bcrypt.compare("doctor123", doc.password);
        console.log("bcrypt.compare('doctor123', doc.password):", testMatch);
    }

    await mongoose.disconnect();
}
inspectDoc().catch(console.error);
