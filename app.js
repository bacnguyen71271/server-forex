const express = require('express');
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require('express-session');
const Passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('crypto-js');


var sessionMiddleware = session({
    name: "COOKIE_NAME_HERE",
    secret: "COOKIE_SECRET_HERE",
    store: new (require("connect-mongo")(session))({
        url: "mongodb://127.0.0.1:27017/forex"
    })
});

mongoose.connect("mongodb://127.0.0.1:27017/forex");

//schema room
const roomSchema = new mongoose.Schema({
    userID:String,
    socketSesion: String,
    fullName:String,
    groupName:String,
    status:String,
    masterOnline:Boolean,
    leaderName:String
})

//schema listUser
const listuserSchema = new mongoose.Schema({
    userID:String,
    socketSesion: String,
    fullName:String,
    room:String,
    leaderName:String
})

const chatSchema = new mongoose.Schema({
    roomID:String,
    user:String,
    content: String
})


const leaderSchema = new mongoose.Schema({
    leaderName: String,
    passwordLeader: String,
    statusLeader: String,
    expirationdate: Date
})

const leader = mongoose.model('leader',leaderSchema);
const room = mongoose.model('room',roomSchema);
const listuser = mongoose.model('listuser',listuserSchema);
const chat = mongoose.model('chat',chatSchema);

//leader.create({leaderName:"admin",passwordLeader:"e10adc3949ba59abbe56e057f20f883e",statusLeader:"01678956166",expirationdate:new Date(2018,09,20).toLocaleDateString()});
var leaderUser = '';

app.set('view engine','ejs');
app.set('views','./views')
app.use("/public",express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended:true}));
//app.use(session({secret:"mysecret"}));
app.use(sessionMiddleware);
app.use(Passport.initialize());
app.use(Passport.session());



app.get('/',(req,res)=>{
    res.render('trangchu');
})

app.get('/logout',(req,res)=>{
    req.logout();
    res.redirect('/');
})

app.get('/leaderadd/:user',(req,res)=>{
    leader.find({leaderName:req.params.user}).exec((err,data)=>{
        if(data.length <= 0){
            leader.create({leaderName:req.params.user,passwordLeader:"123456",statusLeader:"01678956166",expirationdate:new Date(2018,09,20).toLocaleDateString()});
            res.send("Thêm thành công")
        }else{
            res.send('Tài khoản Leader "' +req.params.user + '" đã tồn tại')
        }
    })
})

app.get('/changepwd',(req,res)=>{
    if(req.isAuthenticated()){
        res.render('changepwd');
    }else{
        res.redirect('login');
    }
})

app.get('/leader',(req,res)=>{
    if(req.isAuthenticated()){
        res.render('index');
    }else{
        res.redirect('login');
    }

    if(req.session.passport !== undefined){
        leaderUser = req.session.passport['user'];
    }
})


app.get('/login',(req,res)=>res.render('login'));
app.post('/login',Passport.authenticate('local',{failureRedirect:'/login',successRedirect:'/leader'}));


Passport.use(new LocalStrategy(
    (username,password,done)=>{
        leader.find({leaderName:username,passwordLeader:password}).exec((err,data)=>{
            if(data.length <= 0){
                return done(null,false);
            }else{
                return done(null,data[0]);
            }
        })
    }
))

Passport.serializeUser((user,done)=>{
    done(null,user.leaderName);
})


Passport.deserializeUser((name,done)=>{
    leader.find({leaderName:name}).exec((error,data)=>{
        if(data.length > 0){
            return done(null,data[0]);
        }else
        {
            return done(null,false);
        }
    })
})

var server = app.listen(process.env.PORT || 3000,()=>{
    console.log(process.env.PORT || 3000);
});

var io = require('socket.io')(server)

io.use(function(socket, next){
    // Wrap the express middleware
    sessionMiddleware(socket.request, {}, next);
});


io.on('connection',(socket)=>{
    console.log(socket.id + " : Ket noi");
    socket.on("disconnect",()=>{
        console.log(socket.id + " : Ngat ket noi");
        room.find({socketSesion : socket.id}).exec((error,master)=>{
            if(master.length >= 1){
                //update socketSession
                room.update({userID:master[0].userID},{status:"offline"}).exec((error,resurl)=>{
                    console.log(resurl);
                });
                console.log("Master "+master[0].fullName+" vừa disconnect");
            }
        });

    })

    socket.on("sendinfo",(data)=>{
        room.find({userID:data.arr12}).exec((error,status)=>{
            if(status.length>0){
                if(status[0].masterOnline){
                    io.sockets.in(data.arr12).emit("sendbid",data);
                    console.log("Vua gui " + data +" cho " +data.arr12 );
                }else{
                    console.log("Master "+data.arr12 + " đã nghỉ chơi" );
                }
            }
        })
        
    })


    socket.on("getTrangThaiMaster",(data)=>{
        room.find({userID:data}).exec((err,data)=>{
            if(data.length > 0 ){
                if(data[0].masterOnline && data[0].status ==="online"){
                    socket.emit("sendTrangThaiMasTer",true);
                }else{
                    socket.emit("sendTrangThaiMasTer",false);
                }
            }else{
                socket.emit("sendTrangThaiMasTer",false);
            }
        })
    })

    socket.on("deleteUser",(data)=>{
        listuser.deleteMany({userID:data},(err,resurl)=>{
            socket.emit("reg_status","Đã xóa user "+ data);
        })
    })

    socket.on("deleteMaster",(data)=>{
        room.deleteMany({userID:data},(err,resurl)=>{
            socket.emit("reg_status","Đã xóa master "+ data);
        })
    })
    
  
    socket.on("online",(data)=>{
        room.find({userID : data}).exec((error,master)=>{
            if(master.length >= 1){
                socket.join(data);
                //update socketSession
                room.update({userID:master[0].userID},{socketSesion:socket.id,status:"online"}).exec((error,resurl)=>{
                });
                console.log("Master "+master[0].fullName+" vừa online");
            }else{
                listuser.find({userID:data}).exec((error,user)=>{
                    if(user.length >= 1){
                        if(user[0].room !== ""){
                            listuser.update({userID:data},{socketSesion:socket.id}).exec((error,resurl)=>{});
                            socket.join(user[0].room);    
                            console.log("Người chơi "+user[0].userID+" vừa online và join vào room "+ user[0].room);
                            room.find({userID:user[0].room}).exec((error,data)=>{
                                socket.emit("sendRoomName",data[0].groupName);
                            })
                            //console.log(socket.adapter.rooms)
                        }else{
                            console.log("Nguoi choi "+user[0].userID+" vừa online");
                        }
                    }else{
                        console.log("Nguoi choi chua dang ky");
                    }
                })
            }

        })
    })


    socket.on("masteronline",(data)=>{
        room.find({userID : data}).exec((error,user)=>{
            console.log(data);
            if(user.length >= 1){
                socket.join(data);
                socket.Phong = data;
                room.update({userID: data},{masterOnline : true})
                .exec((error,resurl)=>{
                    
                })
                console.log("Master "+ data +" đã bật chế độ chơi");
            }else{
                socket.emit("reg_status","Master "+data+" chưa đăng ký. Hãy liên hệ với người chủ quản để tham gia đội ngũ chuyên gia");
            }
        })
    })

    socket.on("masteroffline",(data)=>{
        room.find({userID : data}).exec((error,user)=>{
            console.log(data);
            if(user.length >= 1){
                //thay doi trang thai master
                room.update({userID: data},{masterOnline : false})
                .exec((error,resurl)=>{
                })

                console.log("Master "+data+ " đã ngừng chơi");
            }else{
                socket.emit("reg_status","Master "+data+" chưa đăng ký. Hãy liên hệ với người chủ quản để tham gia đội ngũ chuyên gia");
            } 
        })
    })

    socket.on("reg_group",(data)=>{
        room.find({userID:data.accountID}).exec((error,user)=>{
            if(user.length < 1){
                room.create({
                    userID: data.accountID,
                    socketSesion:"",
                    fullName:data.name,
                    groupName:data.groupname,
                    status: "",
                    masterOnline: false,
                    leaderName:socket.request.session.passport['user']
                });
                socket.emit("reg_status","Đăng ký thành công Account ID "+ data.accountID);
                room.find().exec((err,resurl)=>{
                    socket.emit("danhsachroom",resurl);
                })
            }else{
                socket.emit("reg_status","Account ID "+ data.accountID + " đã tồn tại");
            }
        })
    })
   
    socket.on("reg_user",(data)=>{
        room.find({userID:data.accountID}).exec((error,user)=>{
            if(user.length < 1){
                listuser.create({
                    userID: data.accountID,
                    socketSesion:"",
                    fullName: data.name,
                    room:'',
                    leaderName:socket.request.session.passport['user']
                });
                socket.emit("reg_status","Đăng ký thành công Account ID "+ data.accountID);
            }else{
                socket.emit("reg_status","Account ID "+ data.accountID + " đã tồn tại");
            }
        })
    })

    socket.on("getMasterOnline",()=>{
        room.find({masterOnline:true,status:"online"}).exec((err,resurl)=>{
            //console.log(resurl);
            var listMaster = [];
            if(resurl !== null){
                socket.emit("listmasterOnline",resurl);
            }
        })
    });
//mới vcl

    socket.on("laydanhsachroom",(data)=>{
        
        var userrrr = '';
        
        if(socket.request.session.passport !== undefined){
            userrrr = socket.request.session.passport['user'];
        }else{
            userrrr = data;

            listuser.find({userID:data}).exec((err,data2)=>{
                if(data.length > 0 ){
                    userrrr = data2[0].leaderName;
                }
            })
        }
        console.log(userrrr);
        room.find({leaderName:userrrr}).exec((err,resurl)=>{
            var dsroom = [];
            for(var i=0;i<resurl.length;i++){
                if(resurl[i].masterOnline && resurl[i].status === "online"){
                    dsroom.push({fullName:resurl[i].fullName,userID:resurl[i].userID,groupName:resurl[i].groupName,status:"<div class='green'></div>"});
                }else{
                    dsroom.push({fullName:resurl[i].fullName,userID:resurl[i].userID,groupName:resurl[i].groupName,status:"<div class='red'></div>"});
                }
            }
            socket.emit("danhsachroom",dsroom);
        })
    });

    socket.on("laydanhsachuser",(data)=>{
        if(socket.request.session.passport !== undefined)
        {
            listuser.find({leaderName:socket.request.session.passport['user']}).exec((err,resurl)=>{
                socket.emit("danhsachslave",resurl);
            })
        }
    });


    socket.on("change_pass",(data)=>{
        leader.find({leaderName:socket.request.session.passport['user'],passwordLeader:data.oldpass}).exec((errr,data2)=>{
            if(data2.length > 0 ){
                leader.update({leaderName:data2[0].leaderName},{passwordLeader:data.newpasss}).exec((err,data3)=>{})
                socket.emit("reg_status","Đổi mật khẩu thành công");
            }else{
                socket.emit("reg_status","Mật khẩu không đúng");
            }
        })
    })


    function sendContent(room){
        console.log(room);
        chat.find({roomID:room}).limit(50).exec((error,resul)=>{
            console.log(resul);
            socket.emit("noidungchat",resul);
        })
    }
    
    /*
    socket.on("laynoidungchat",(data)=>{
        console.log("laynoidungchat"+data);
        room.find({socketSesion:socket.id}).exec((err,resurl)=>{
            console.log(resurl);
            if(resurl.length > 0){
                sendContent(resurl[0].userID);
            }else{
                listuser.find({userID:data}).exec((err,resurl)=>{
                    console.log(resurl);
                    if(resurl.length >0){
                        sendContent(resurl[0].room);
                    }
                })
            }
        })
    })
*/

/*
    socket.on("sendchat",(data)=>{
        room.find({socketSesion:socket.id}).exec((err,resurl)=>{
            if(resurl.length > 0){
                //io.sockets.in(resurl.userID).emit("sendnoidung","test");
                chat.create({
                    roomID:resurl[0].userID,
                    user:resurl[0].fullName,
                    content:data
                });
                io.sockets.in(resurl[0].userID).emit("sendnoidung",{user:resurl[0].fullName,noidung:data});
                console.log(resurl[0].userID);
            }else{
                listuser.find({socketSesion:socket.id}).exec((err,resurl)=>{
                    if(resurl.length >0){
                        chat.create({
                            roomID:resurl[0].room,
                            user:resurl[0].fullName,
                            content:data
                        });
                        io.sockets.in(resurl[0].room).emit("sendnoidung",{user:resurl[0].fullName,noidung:data});
                    }
                })
            }
        })
    });
*/

    socket.on("changemaster",(data)=>{
        console.log(data.userid);
        console.log(data.idroom);
        listuser.find({userID:data.userid}).exec((err,resr)=>{
            if(resr.length >0){
                if(resr[0].room === data.idroom){
                    socket.emit("reg_status","Bạn đã ở trong phòng này !");
                }else{
                    socket.leave(resr[0].room);
                    socket.join(data.idroom);
                    listuser.update({userID: data.userid},{room : data.idroom})
                    .exec((error,resurl)=>{
                        console.log(resurl);
                        room.find({userID:data.idroom},(error,resurl2)=>{
                            if(resurl2.length>0){
                                console.log("User: "+socket.userID+ " đã join room "+resurl2[0].groupName);
                                socket.emit("sendRoomName",resurl2[0].groupName);
                            }else{
                                
                            }
                        })
                    })
                }
            }
        })

        
    })
})

