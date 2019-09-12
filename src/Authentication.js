const jwt= require('jsonwebtoken');
const APP_SECRET="Powerhouse_gym_training_yard";

function getUserId(context) {
    const auth=context.event.headers.authorization;
    if(auth) {
        const token = auth.replace('Bearer ','');
        const {userId}=jwt.verify(token,APP_SECRET);
        return userId
    }
    throw new Error('Not authenticated')
}

module.exports={
    APP_SECRET,
    getUserId,
}
