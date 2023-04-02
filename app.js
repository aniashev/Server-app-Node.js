let express = require('express');
require("dotenv").config();
const jwt = require("jsonwebtoken");
let app = express();
let bcrypt = require('bcrypt');
let models = require('./models.js');

app.use(express.json());


app.get('/health', async (req, resp) => {
    resp.status(200).json('{"heath": "HEALTHY!"}')
})

// 1.Register user
app.post('/user', async (req, resp) => {
    try {
        let {username, password, admin, subordinates} = req.body;
        let salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(password, salt);

        await models.User.create({username: username, password: hashedPassword, admin: admin, subordinates: subordinates})
        .then(result => {
            console.log('New user have been saved!');
            console.log(result);
            resp.status(200).json({status: 'ok', id: result._id});
        })
        .catch(error => {
            resp.status(400).json({error: error.message});
        });
    }
    catch(error){
        console.error('Error saving user to the database', error);
        resp.status(400).json({error: error.message});
    }
})

//2. Authenticate user
app.post('/user/login', async (req, resp) => {
    try {
        const {username, password} = req.body;

        if (!(username && password)) {
            resp.status(400).send("'username' and 'password' are required");
        }

        let user = await models.User.findOne({username});
        if(!user){
            return resp.status(404).json({error:'User not found!'});
        }
        if(!await bcrypt.compare (password, user.password)){
            return resp.status(401).json({error: 'Invalid password!'});
        }

        const token = jwt.sign(
            { user_id: user._id },
            process.env.TOKEN_KEY,
            { expiresIn: "2h" }
        );

        resp.status(200).json({token: token}); 
    }
    catch(error){
        resp.status(400).json({error: error.message});
    }
})


//3.Return list of users
app.get('/users', async (req, resp)=>{
    try {
        if (!req.headers.authorization) {
          return resp.status(401).json({ error: "Not Authorized" });
        }
        
        const authHeader = req.headers.authorization;
        const token = authHeader.split(" ")[1];

        try {
            const { user_id } = jwt.verify(token, process.env.TOKEN_KEY);

            const user = await models.User.findOne({_id: user_id});

            let userList;
            if(user.admin === true){
                userList = await models.User.find();
                userList = userList.map(u => u._id);
            }
            else if(user.subordinates.length === 0){
                userList = [user._id];
            }            
            else {
                userList = await user.getAllSubordinates();
                userList.push(user._id)
            } 
            let users = await models.User.find({_id: {$in: userList}});
            users = users.map(u => [u.username, u.admin]);
            return resp.status(200).json(users);
        } catch (error) {
            return resp.status(401).json({ error: "Not Authorized" });
        }
    } catch (error) {
    resp.status(400).json({ error: error.message });
  }
});


//4.Change user's boss
  app.post('/user/change-boss', async (req, resp) => {
    try{
        if (!req.headers.authorization) {
            return resp.status(401).json({ error: "Not Authorized" });
          }
          const authHeader = req.headers.authorization;
          const token = authHeader.split(" ")[1];
        try {
            const { user_id } = jwt.verify(token, process.env.TOKEN_KEY);
            const {target_user_id, new_boss_id} = req.body;
            const user = await models.User.findById(user_id);
            const targetUser = await models.User.findById(target_user_id);
            const newBoss = await models.User.findById(new_boss_id);
        
            if (!targetUser || !newBoss){
                return resp.status(404).json({error: 'User not found!'});
            }
            if (!user.isSubordinate(targetUser) || !user.isSubordinate(newBoss)) { 
                return resp.status(401).json({ error: "Unauthorized to update user" }); 
            }
            else {  
                let result1 = await newBoss.addSubordinate(targetUser);
                console.log(result1);
                let result2 = await user.removeSubordinate(targetUser);
                console.log(result2);
                return resp.status(200).json({});
            }
        } catch (error) {
            resp.status(400).json({ error: error.message });
        }
    } catch (error) {
        resp.status(400).json({ error: error.message });
    }
})

app.listen(3000, () =>{
    console.log('Listening 3000...')
})


