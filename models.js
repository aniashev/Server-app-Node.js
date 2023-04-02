let mongoose  = require('mongoose');
let Schema = mongoose.Schema;

let uri = 'mongodb://localhost:27017/organization';

mongoose.connect(uri).then(() => {
   console.log('Connected to MongoDB');
}).catch((error) =>{
    console.log('Error connecting to MongoDB');
})

const userSchema = new Schema({
    username: {type: String, required: true},
    password: {type: String, required: true},
    admin: {type: Boolean, required: false, default: false},
    subordinates: {type: [mongoose.Schema.Types.ObjectId], ref:'User', required: false, default: []},
    token: { type: String }
})

userSchema.methods.isSubordinate = function(user) {
    return this.subordinates.includes(user._id);
}

userSchema.methods.addSubordinate = async function(user) {
    this.subordinates.push(user._id);
    await this.save();
}

userSchema.methods.removeSubordinate = async function(user) {
    this.subordinates.remove(user._id);
    await this.save();
    return "YAY";
}

userSchema.methods.getAllSubordinates = async function() {
    let subordinates = JSON.parse(JSON.stringify(this.subordinates));
    
    for (let i = 0; i < subordinates.length; i++) {
        const subordinate = await User.findById(subordinates[i]);
        if(subordinate.subordinates.length != 0) {
            const subordinateSubordinates = await subordinate.getAllSubordinates();
            subordinates.splice(i + 1, 0,...subordinateSubordinates);
        } else {
            const newSubordinate = await User.findById(subordinate);
            subordinates[i] = JSON.parse(JSON.stringify(newSubordinate._id));
        }
    }
    return subordinates;
}

const User = mongoose.model('users', userSchema);

module.exports = { User };
