import jwt from 'jsonwebtoken'
import doctorModel from '../models/doctorModel.js'

// doctor authentication middleware
const authDoctor = async (req, res, next) => {
    const { dtoken } = req.headers
    if (!dtoken) {
        return res.status(401).json({ success: false, message: 'Not Authorized: Please log in as a practitioner.' })
    }
    try {
        const token_decode = jwt.verify(dtoken, process.env.JWT_SECRET)
        if (token_decode.role && token_decode.role !== 'doctor') {
            return res.status(403).json({ success: false, message: 'Forbidden: Practitioner credentials required.' })
        }

        const doctor = await doctorModel.findById(token_decode.id).select('_id')
        if (!doctor) {
            return res.status(403).json({ success: false, message: 'Unauthorized: Practitioner account not found.' })
        }

        if (!req.body) {
            req.body = {}
        }
        req.body.docId = token_decode.id
        req.docId = token_decode.id
        next()
    } catch (error) {
        console.log(error)
        res.status(401).json({ success: false, message: error.message || 'Session expired, please login again' })
    }
}

export default authDoctor;