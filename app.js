const express = require('express');
const app = express();
const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/forex");

//schema room
const roomSchema = new mongoose.Schema({
    userID:String,
    socketSesion: String,
    fullName:String,
    groupName:String,
    status:String,
    masterOnline:Boolean
})

//schema listUser
const listuserSchema = new mongoose.Schema({
    userID:String,
    socketSesion: String,
    fullName:String,
    room:String
})

const chatSchema = new mongoose.Schema({
    roomID:String,
    user:String,
    content: String
})

const room = mongoose.model('room',roomSchema);
const listuser = mongoose.model('listuser',listuserSchema);
const chat = mongoose.model('chat',chatSchema);

var server = app.listen(process.env.PORT || 3000,()=>{
    console.log(process.env.PORT || 3000);
});

var io = require('socket.io').listen(server);


app.set('view engine','ejs');
app.set('views','./views')
app.use(express.static('public'));


io.on('connection',(socket)=>{
    console.log(socket.id + " : Ket noi");
    socket.on("disconnect",()=>{
        console.log(socket.id + " : Ngat ket noi");
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
                room.update({userID:data},{socketSesion:socket.id}).exec((error,resurl)=>{});
                console.log("Master "+master[0].fullName+" vừa online");
            }else{
                listuser.find({userID:data}).exec((error,user)=>{
                    if(user.length >= 1){
                        if(user[0].room !== ""){
                            listuser.update({userID:data},{socketSesion:socket.id}).exec((error,resurl)=>{});
                            socket.join(user[0].room);    
                            console.log("Người chơi "+user[0].userID+" vừa online và join vào room "+ user[0].room);
                            console.log(socket.adapter.rooms)
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

    socket.on("getUserOnline",(data)=>{
        //console.log(socket.adapter.rooms.find(room));
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
                    masterOnline: false
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
                    room:''
                });
                socket.emit("reg_status","Đăng ký thành công Account ID "+ data.accountID);
            }else{
                socket.emit("reg_status","Account ID "+ data.accountID + " đã tồn tại");
            }
        })
    })

    socket.on("laydanhsachroom",(data)=>{
        room.find().exec((err,resurl)=>{
            socket.emit("danhsachroom",resurl);
        })
    });

    socket.on("laydanhsachuser",(data)=>{
        listuser.find().exec((err,resurl)=>{
            socket.emit("danhsachroom",resurl);
        })
    });


    function sendContent(room){
        console.log(room);
        chat.find({roomID:room}).limit(50).exec((error,resul)=>{
            console.log(resul);
            socket.emit("noidungchat",resul);
        })
    }
    
    socket.on("laynoidungchat",(data)=>{
        console.log("laynoidungchat"+data);
        room.find({socketSesion:socket.id}).exec((err,resurl)=>{
            console.log(resurl);
            if(resurl.length > 0){
                sendContent(resurl[0].userID);
            }else{
                listuser.find({socketSesion:socket.id}).exec((err,resurl)=>{
                    if(resurl.length >0){
                        sendContent(resurl[0].room);
                    }
                })
            }
        })
    })

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


    socket.on("changemaster",(data)=>{
        if(socket.Phong2 === data){
            socket.emit("reg_status","Bạn đã ở trong phòng này !");
        }else{
            socket.leave(socket.Phong2);
            socket.join(data);
            socket.Phong2 = data;
            listuser.update({userID: socket.userID},{room : data})
            .exec((error,resurl)=>{
                room.find({userID:data},(error,resurl2)=>{
                    if(resurl2.length>0){
                        console.log("User: "+socket.userID+ " đã join room "+resurl2[0].groupName)
                        socket.emit("titleroom",resurl2[0].groupName);
                    }else{
                        
                    }
                })
            })
        }
    })
})

app.get('/addmaster',(req,res)=>{
    res.render('addmaster');
})

app.get('/addslave',(req,res)=>{
    res.render('addslave');
})


app.get('/',(req,res)=>{
    res.render('index');
})