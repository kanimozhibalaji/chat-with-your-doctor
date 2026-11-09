import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";
import doctorModel from "./models/doctorModel.js";
import userModel from "./models/userModel.js";
import appointmentModel from "./models/appointmentModel.js";

const sampleDoctors = [
    // 1. General physician (2 doctors)
    {
        name: "Dr. Richard James",
        email: "richard.james@example.com",
        speciality: "General physician",
        degree: "MBBS, MD (Internal Medicine)",
        experience: "5 Years",
        about: "Dr. Richard James is dedicated to primary care, preventive wellness, and early diagnosis of acute and chronic health conditions including fever, infections, hypertension, and diabetes.",
        fees: 50,
        available: true,
        address: { line1: "17th Cross, Richmond Medical Center", line2: "Circle, Ring Road" },
        image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Timothy White",
        email: "timothy.white@example.com",
        speciality: "General physician",
        degree: "MBBS, FAGE",
        experience: "10 Years",
        about: "Dr. Timothy White is a senior general practitioner managing lifestyle diseases, blood pressure, metabolic syndromes, seasonal illnesses, and comprehensive adult health checkups.",
        fees: 65,
        available: true,
        address: { line1: "88 Boulevard Clinic", line2: "Westside Medical District" },
        image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=500&auto=format&fit=crop&q=80"
    },

    // 2. Gynecologist (2 doctors)
    {
        name: "Dr. Emily Larson",
        email: "emily.larson@example.com",
        speciality: "Gynecologist",
        degree: "MBBS, MS - Obstetrics & Gynaecology",
        experience: "6 Years",
        about: "Dr. Emily Larson specializes in comprehensive maternal health, prenatal care, PCOS management, reproductive medicine, and preventive women's wellness.",
        fees: 60,
        available: true,
        address: { line1: "27th Cross, Women's Care Pavilion", line2: "Circle, Ring Road" },
        image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Ryan Martinez",
        email: "ryan.martinez@example.com",
        speciality: "Gynecologist",
        degree: "MBBS, DGO, MD",
        experience: "4 Years",
        about: "Dr. Ryan Martinez provides compassionate care in high-risk obstetrics, fertility consultations, menstrual health, and minimally invasive gynecological procedures.",
        fees: 55,
        available: true,
        address: { line1: "14 Blossom Healthcare Plaza", line2: "Midtown Avenue" },
        image: "https://images.unsplash.com/photo-1622902046580-2b47f47f5471?w=500&auto=format&fit=crop&q=80"
    },

    // 3. Dermatologist (2 doctors)
    {
        name: "Dr. Sarah Patel",
        email: "sarah.patel@example.com",
        speciality: "Dermatologist",
        degree: "MBBS, DVD, MD - Dermatology",
        experience: "5 Years",
        about: "Dr. Sarah Patel offers expert diagnostic and therapeutic care for acne, eczema, psoriasis, skin allergies, hair restoration, and clinical dermatology.",
        fees: 45,
        available: true,
        address: { line1: "37th Cross, DermaCare Suite", line2: "Circle, Ring Road" },
        image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Ava Mitchell",
        email: "ava.mitchell@example.com",
        speciality: "Dermatologist",
        degree: "MBBS, MD - Dermatology",
        experience: "4 Years",
        about: "Dr. Ava Mitchell provides tailored skin therapy, pediatric dermatology, mole mapping, and evidence-based treatments for chronic skin and scalp conditions.",
        fees: 55,
        available: true,
        address: { line1: "12th Avenue, Central Park Clinic", line2: "Downtown Medical Hub" },
        image: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=500&auto=format&fit=crop&q=80"
    },

    // 4. Pediatricians (2 doctors)
    {
        name: "Dr. Christopher Lee",
        email: "christopher.lee@example.com",
        speciality: "Pediatricians",
        degree: "MBBS, DCH, MD - Pediatrics",
        experience: "6 Years",
        about: "Dr. Christopher Lee focuses on child growth and development, newborn care, immunization schedules, and acute pediatric infections.",
        fees: 40,
        available: true,
        address: { line1: "47th Cross, Rainbow Children's Wing", line2: "Circle, Ring Road" },
        image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Jeffrey King",
        email: "jeffrey.king@example.com",
        speciality: "Pediatricians",
        degree: "MBBS, MD - Child Health",
        experience: "5 Years",
        about: "Dr. Jeffrey King specializes in pediatric nutrition, childhood asthma, allergies, behavioral milestones, and gentle care for infants and children.",
        fees: 45,
        available: true,
        address: { line1: "22 Sunshine Pediatric Center", line2: "Parkview Road" },
        image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=500&auto=format&fit=crop&q=80"
    },

    // 5. Neurologist (2 doctors)
    {
        name: "Dr. Jennifer Garcia",
        email: "jennifer.garcia@example.com",
        speciality: "Neurologist",
        degree: "MBBS, DM - Neurology",
        experience: "8 Years",
        about: "Dr. Jennifer Garcia is an experienced neurologist providing specialized care for chronic migraines, epilepsy, neuropathy, stroke recovery, and sleep disorders.",
        fees: 80,
        available: true,
        address: { line1: "57th Cross, NeuroSciences Institute", line2: "Circle, Ring Road" },
        image: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Zoe Kelly",
        email: "zoe.kelly@example.com",
        speciality: "Neurologist",
        degree: "MBBS, MD, DM - Clinical Neurology",
        experience: "6 Years",
        about: "Dr. Zoe Kelly treats complex headache syndromes, vertigo, movement disorders, nerve compression, and memory-related neurological conditions.",
        fees: 75,
        available: true,
        address: { line1: "90 Apex Brain & Spine Center", line2: "Northgate Boulevard" },
        image: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=500&auto=format&fit=crop&q=80"
    },

    // 6. Gastroenterologist (2 doctors)
    {
        name: "Dr. Andrew Williams",
        email: "andrew.williams@example.com",
        speciality: "Gastroenterologist",
        degree: "MBBS, DM - Gastroenterology",
        experience: "7 Years",
        about: "Dr. Andrew Williams specializes in digestive tract disorders, acid reflux (GERD), irritable bowel syndrome, liver health, and therapeutic nutrition.",
        fees: 75,
        available: true,
        address: { line1: "67th Cross, Digestive Health Center", line2: "Circle, Ring Road" },
        image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Patrick Harris",
        email: "patrick.harris@example.com",
        speciality: "Gastroenterologist",
        degree: "MBBS, MD, DM - Hepatology & GI",
        experience: "5 Years",
        about: "Dr. Patrick Harris focuses on fatty liver management, gastritis, food intolerances, inflammatory bowel conditions, and preventive gut care.",
        fees: 70,
        available: true,
        address: { line1: "31 Metro Gastro & Liver Clinic", line2: "Harbor View Road" },
        image: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=500&auto=format&fit=crop&q=80"
    },

    // 7. Cardiologist (2 doctors)
    {
        name: "Dr. Arjun Mehta",
        email: "arjun.mehta@example.com",
        speciality: "Cardiologist",
        degree: "MBBS, MD, DM - Cardiology",
        experience: "9 Years",
        about: "Dr. Arjun Mehta is a senior cardiologist specializing in hypertension, chest pain evaluation, arrhythmia management, lipid control, and preventive heart care.",
        fees: 90,
        available: true,
        address: { line1: "101 HeartBeat Cardiac Center", line2: "Link Road, Medical Square" },
        image: "https://images.unsplash.com/photo-1618498082410-b4aa22193b38?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Elena Rostova",
        email: "elena.rostova@example.com",
        speciality: "Cardiologist",
        degree: "MBBS, FACC, DM - Cardiology",
        experience: "7 Years",
        about: "Dr. Elena Rostova provides comprehensive cardiovascular consultations, heart failure management, post-angioplasty follow-ups, and women's heart health.",
        fees: 85,
        available: true,
        address: { line1: "104 HeartBeat Cardiac Center", line2: "Link Road, Medical Square" },
        image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80"
    },

    // 8. Orthopedic (2 doctors)
    {
        name: "Dr. Marcus Vance",
        email: "marcus.vance@example.com",
        speciality: "Orthopedic",
        degree: "MBBS, MS - Orthopaedics",
        experience: "8 Years",
        about: "Dr. Marcus Vance treats sports injuries, knee and shoulder pain, arthritis, back pain, fractures, and posture-related musculoskeletal problems.",
        fees: 70,
        available: true,
        address: { line1: "52 OrthoCare Bone & Joint Clinic", line2: "Greenfield Avenue" },
        image: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Vikram Nair",
        email: "vikram.nair@example.com",
        speciality: "Orthopedic",
        degree: "MBBS, DNB - Orthopedics",
        experience: "6 Years",
        about: "Dr. Vikram Nair specializes in spine rehabilitation, ligament injuries, joint preservation, and minimally invasive orthopedic care.",
        fees: 65,
        available: true,
        address: { line1: "19 Mobility Spine & Joint Center", line2: "South Extension" },
        image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop&q=80"
    },

    // 9. Psychiatrist (1 doctor)
    {
        name: "Dr. Maya Lin",
        email: "maya.lin@example.com",
        speciality: "Psychiatrist",
        degree: "MBBS, MD - Psychiatry",
        experience: "7 Years",
        about: "Dr. Maya Lin offers empathetic, confidential care for anxiety, depression, workplace stress, panic disorders, ADHD, and sleep disturbances.",
        fees: 75,
        available: true,
        address: { line1: "40 Serenity Mind & Wellness Studio", line2: "Oakwood Boulevard" },
        image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=500&auto=format&fit=crop&q=80"
    },

    // 10. Ophthalmologist (1 doctor)
    {
        name: "Dr. Sophia Al-Mansoor",
        email: "sophia.mansoor@example.com",
        speciality: "Ophthalmologist",
        degree: "MBBS, MS - Ophthalmology, FRCS",
        experience: "6 Years",
        about: "Dr. Sophia Al-Mansoor specializes in digital eye strain, dry eyes, cataract evaluation, glaucoma screening, and diabetic retinopathy care.",
        fees: 60,
        available: true,
        address: { line1: "75 ClearVision Eye Institute", line2: "Crescent Road" },
        image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&auto=format&fit=crop&q=80"
    },

    // 11. ENT Specialist (1 doctor)
    {
        name: "Dr. Daniel O'Connor",
        email: "daniel.oconnor@example.com",
        speciality: "ENT Specialist",
        degree: "MBBS, MS - ENT (Otorhinolaryngology)",
        experience: "5 Years",
        about: "Dr. Daniel O'Connor treats sinusitis, ear infections, tonsillitis, hearing loss, tinnitus, throat pain, and nasal allergies.",
        fees: 55,
        available: true,
        address: { line1: "63 Sound & Sinus ENT Clinic", line2: "Victoria Street" },
        image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=500&auto=format&fit=crop&q=80"
    },

    // 12. Dentist (1 doctor)
    {
        name: "Dr. Hannah Abbott",
        email: "hannah.abbott@example.com",
        speciality: "Dentist",
        degree: "BDS, MDS - Conservative Dentistry & Endodontics",
        experience: "5 Years",
        about: "Dr. Hannah Abbott provides painless root canal treatments, toothache relief, gum care, wisdom tooth consultations, and preventive oral hygiene.",
        fees: 45,
        available: true,
        address: { line1: "29 PearlSmile Dental Studio", line2: "High Street" },
        image: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=500&auto=format&fit=crop&q=80"
    }
];

const sampleUsers = [
    {
        name: "John Doe",
        email: "johndoe@example.com",
        phone: "+1 234 567 8901",
        gender: "Male",
        dob: "1994-05-15",
        address: { line1: "123 Main Street", line2: "Apartment 4B, New York" },
        image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&auto=format&fit=crop&q=80"
    },
    {
        name: "Alice Smith",
        email: "alicesmith@example.com",
        phone: "+1 987 654 3210",
        gender: "Female",
        dob: "1998-11-20",
        address: { line1: "456 Oak Avenue", line2: "Suite 12, Los Angeles" },
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80"
    }
];

const seedDatabase = async () => {
    try {
        console.log("Connecting to MongoDB...");
        const dbName = process.env.MONGODB_DB_NAME || 'prescripto';
        const uri = process.env.MONGODB_URI.replace(/\/$/, '') + '/' + dbName;
        await mongoose.connect(uri);
        console.log("Connected successfully!");

        // 1. Seed / Upsert Doctors across all 12 specializations
        console.log("Seeding doctors across all specializations...");
        const doctorSalt = await bcrypt.genSalt(10);
        const defaultPassword = await bcrypt.hash("doctor123", doctorSalt);

        const insertedDoctors = [];
        for (const doc of sampleDoctors) {
            const existingDoc = await doctorModel.findOne({ email: doc.email });
            if (!existingDoc) {
                const newDoc = new doctorModel({
                    ...doc,
                    password: defaultPassword,
                    slots_booked: {},
                    date: Date.now()
                });
                const saved = await newDoc.save();
                insertedDoctors.push(saved);
                console.log(`+ Added Doctor: ${doc.name} (${doc.speciality})`);
            } else {
                // Update existing doctor metadata & image to ensure valid portrait and bio
                existingDoc.speciality = doc.speciality;
                existingDoc.degree = doc.degree;
                existingDoc.experience = doc.experience;
                existingDoc.about = doc.about;
                existingDoc.fees = doc.fees;
                existingDoc.image = doc.image;
                existingDoc.address = doc.address;
                await existingDoc.save();
                insertedDoctors.push(existingDoc);
                console.log(`~ Updated Existing Doctor: ${doc.name} (${doc.speciality})`);
            }
        }

        // 2. Seed Users
        console.log("\nSeeding users...");
        const userSalt = await bcrypt.genSalt(10);
        const userPassword = await bcrypt.hash("user123", userSalt);

        const insertedUsers = [];
        for (const usr of sampleUsers) {
            const existingUser = await userModel.findOne({ email: usr.email });
            if (!existingUser) {
                const newUser = new userModel({
                    ...usr,
                    password: userPassword
                });
                const saved = await newUser.save();
                insertedUsers.push(saved);
                console.log(`+ Added User: ${usr.name}`);
            } else {
                insertedUsers.push(existingUser);
                console.log(`~ Existing User skipped: ${usr.name}`);
            }
        }

        // 3. Seed Sample Appointments if needed
        console.log("\nSeeding sample appointments...");
        if (insertedDoctors.length > 0 && insertedUsers.length > 0) {
            const u1 = insertedUsers[0];
            const d1 = insertedDoctors[0];
            const d2 = insertedDoctors[2];

            const sampleAppointments = [
                {
                    userId: u1._id.toString(),
                    docId: d1._id.toString(),
                    slotDate: "20_08_2026",
                    slotTime: "10:00 AM",
                    userData: u1,
                    docData: d1,
                    amount: d1.fees,
                    date: Date.now(),
                    cancelled: false,
                    payment: true,
                    isCompleted: false
                },
                {
                    userId: u1._id.toString(),
                    docId: d2._id.toString(),
                    slotDate: "22_08_2026",
                    slotTime: "02:30 PM",
                    userData: u1,
                    docData: d2,
                    amount: d2.fees,
                    date: Date.now() - 86400000,
                    cancelled: false,
                    payment: true,
                    isCompleted: true
                }
            ];

            for (const appt of sampleAppointments) {
                const existingAppt = await appointmentModel.findOne({
                    userId: appt.userId,
                    docId: appt.docId,
                    slotDate: appt.slotDate,
                    slotTime: appt.slotTime
                });
                if (!existingAppt) {
                    const newAppt = new appointmentModel(appt);
                    await newAppt.save();
                    console.log(`+ Added Appointment for ${u1.name} with ${appt.docData.name}`);
                } else {
                    console.log(`~ Existing Appointment skipped`);
                }
            }
        }

        // Print summary by specialization
        const allDocs = await doctorModel.find({});
        const summary = {};
        allDocs.forEach((d) => {
            summary[d.speciality] = (summary[d.speciality] || 0) + 1;
        });
        console.log("\n=== Doctor Count by Specialization ===");
        Object.entries(summary).forEach(([spec, count]) => {
            console.log(`  • ${spec}: ${count} doctor(s)`);
        });
        console.log(`Total Doctors in Database: ${allDocs.length}`);

        console.log("\nDatabase Seeding Completed Successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding Error:", err);
        process.exit(1);
    }
};

seedDatabase();
