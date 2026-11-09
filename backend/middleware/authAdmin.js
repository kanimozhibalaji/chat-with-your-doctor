import jwt from "jsonwebtoken"

// admin authentication middleware
const authAdmin = async (req, res, next) => {
    try {
        const { atoken } = req.headers
        if (!atoken) {
            return res.status(401).json({ success: false, message: 'Not Authorized Login Again' })
        }
        const token_decode = jwt.verify(atoken, process.env.JWT_SECRET)
        const isRoleAdmin = typeof token_decode === 'object' && token_decode?.role === 'admin';
        const isLegacyMatch = token_decode === (process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD);

        if (!isRoleAdmin && !isLegacyMatch) {
            return res.status(401).json({ success: false, message: 'Not Authorized Login Again' })
        }
        req.isAdmin = true
        next()
    } catch (error) {
        console.log(error)
        res.status(401).json({ success: false, message: error.message || 'Invalid admin token' })
    }
}

export default authAdmin;