import jwt from 'jsonwebtoken'

// user authentication middleware
const authUser = async (req, res, next) => {
    const { token } = req.headers
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not Authorized: Please log in to continue.' })
    }
    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET)
        if (token_decode.role && token_decode.role !== 'user') {
            return res.status(403).json({ success: false, message: 'Forbidden: Patient credentials required.' })
        }
        if (!req.body) {
            req.body = {}
        }
        req.body.userId = token_decode.id
        req.userId = token_decode.id
        next()
    } catch (error) {
        console.log(error)
        res.status(401).json({ success: false, message: error.message || 'Session expired, please login again' })
    }
}

export default authUser;