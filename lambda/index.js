const { ApolloServer,gql } = require('apollo-server-lambda');
const {prisma}= require('../generated/prisma-client');
const jwt=require('jsonwebtoken');
const bcrypt=require('bcryptjs')
const {APP_SECRET,getUserId}= require('../src/Authentication');
const receipent="hsahu77@gmail.com";
const cron= require('node-cron');
const {request} = require('graphql-request');
const typeDefs=gql`
type Query {
    getAllUsers:[User!]!
    getUser(id:ID!):User!
    getPackageById(id:ID!):Package!
    getMember(id:ID!):Member!
    getAllMembers:[Member!]!
    getPackages:[Package!]!
    getMemberBySearch(name:String!):[Member!]!
    getMemberByDate(name:String!):[Member!]!
    getNotification:[Notification!]!
    getPackageBeforeWeek:[Package!]!
  
}
type Mutation {
    createUser(username:String!,email:String!,password:String!):User!
    createMember(firstName:String!,lastName:String!,email:String!,gender:String!, phoneNumber:String! alternateNumber:String!DOB:String!,address:String!):Member!
    createPackage(name:String!,memberShipId:String!,startDate:String!,endDate:String!,fees:String!):Package!
    signUp(username:String!,email:String!,password:String!):AuthPayload
    login(email:String!,password:String!):AuthPayload,
    forgetPassword(username:String!,email:String!,password:String!):User
    updateUser(email:String!,password:String!):User
    updateMemberPackage(email:String!,name:String!,memberShipId:String!,startDate:String!,endDate:String!,fees:String!,previousPackageId:String!):Package
}

type User {
  id: ID!
  username: String!
  password:String!
  email:String!
  notification:[Notification!]!
  readNotificationCount:String
}
type Member {
  id:ID!
  firstName:String!
  lastName:String!
  email:String!
  gender:String!
  phoneNumber:String!
  alternateNumber:String!
  DOB:String!
  package:[Package!]!
  recommanded:[Member!]!
  address:String!
  status:String!
}
type Package {
  id:ID!
  name:String!
  memberShipId:Member!
  startDate:String!
  endDate:String!
  fees:String!
}
type Subscription {
  memberInformation:Member
}
type AuthPayload {
  token:String!
  user:User
}
type Notification {
  id:ID!
  typeofOperation:String!
  category:String!
  owner:User!
  impactedId:String!
  createdAt:String!
}`;


const resolvers={
    Query:{
        getAllUsers:async (parent,args,context)=>{
            return await context.prisma.users({});
        },
        getPackages:async (parent,args,context)=>{
            const data=await context.prisma.packages({});
        
            return data;
        },
        getPackageById:async (parent,{id},context)=>{
            const data=await context.prisma.package({id});
        
            return data;
        },
        getPackageBeforeWeek:async(parent,args,context)=>{
            let endDate=new Date();
           const endDate_gt= endDate.getFullYear()+ '-' +(endDate.getMonth() + 1) + '-'+ (endDate.getDate());
            endDate= endDate.getFullYear() + '-'+ (endDate.getMonth() + 1) + '-'+ (endDate.getDate()+7);
            console.log(endDate_gt,endDate);
            const packageData=await context.prisma.packages({
                where: {
                    endDate_gt: endDate_gt,
                    endDate_lt: endDate
                    }
                }
            );
            packageData.forEach(async (item)=>{
                await context.prisma.updatePackage({
                    where: {
                        id:item.id
                        },
                        data:{
                           memberShipId:{
                               update:{
                                   status:"DANGER"
                               }
                           }
                        }
                    } 
                );
            });
  
            return packageData;
        },
        getUser:async (parent,{id},context)=>{
            console.log(id);
            return await context.prisma.user({id});
        },
        getMember:async (parent,{id},context)=>{
            const data=await context.prisma.member({id});
            return data;
        },
        getAllMembers:async(parent,args,context)=>{
          const data=  await context.prisma.members();
           console.log(data);
           return data;
        },
        getMemberBySearch:async(parent,{name},context) =>{
            console.log("Name",name);
           return await context.prisma.members({
                where:{
                    OR:[
                        {
                            firstName_contains:name
                        },
                        {
                            lastName_contains:name
                        },
                        {
                            phoneNumber_contains:name
                        },
                        {

                        },
                        {
                            email_contains:name
                        },
                        {
                            alternateNumber_contains:name
                        },
                        {
                            address_contains:name
                        },
                        {
                            status:name
                        },
                        
                    ]
                    
                }
            });
        },
        getMemberByDate:async(parent,{name},context) => {
            let startDate=new Date(name.split(',')[0]);
            let endDate=new Date(name.split(',')[1]);
            console.log(startDate,endDate)
           
            return await context.prisma.members({
                where:{
                    createdAt_gt: startDate,
                    createdAt_lt:  endDate,
                }
            })
        },
        getNotification:async(parent,args,context)=>{
            return await context.prisma.notifications({orderBy:'createdAt_DESC'})
        }
    },
   
    Mutation:{
        createUser:async(parent,{username,email,password},context)=>{
            try {
                const userId = getUserId(context);
              const loggedInUser=  await context.prisma.user({id:userId});
            const userExists=await context.prisma.users({
                where:{username:username}
            });
            console.log(userExists);
            if(userExists.length!=0){
                throw new Error("user Exists Already Got it")
            }
            const encryptedpassword=await bcrypt.hash(password,10);
            const createdUser=await context.prisma.createUser({
                username,
                email,
                password:encryptedpassword,
                readNotificationCount:"-1"
            })
            await context.prisma.createNotification({
                typeofOperation:'CREATED',
                impactedId:createdUser.id,
                category:"USER",
                owner:{connect:{id:userId}},
                createdAt:new Date(),
                updatedAt:new Date()
            })
           const getAllUsers= await context.prisma.users({});
           getAllUsers.forEach(async element => {
               console.log((parseInt(element.readNotificationCount) +1).toString());
               await context.prisma.updateUser({
                   data:{
                    readNotificationCount:(parseInt(element.readNotificationCount) +1).toString()
                   },
                   where:{
                       id:element.id
                   }
               })
           });
           await fetch('/.netlify/functions/sendemail', {
                method: 'POST',
                headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
                },
                body: JSON.stringify({receipent,loggedInUser,createdData:createdUser,typeofOperation:"CREATED",category:"User"})
  });
            return createdUser;

        }
        catch(err) {
            console.log(err);
        }
        },
        createMember:async(parent,{firstName,lastName,email,gender,phoneNumber,alternateNumber,DOB,address},context)=>{
            const userId=getUserId(context);
            const memberExists=await context.prisma.members({
                where:{email:email}
            });
            if(memberExists.length!=0){
                throw new Error("Member Exists Already Got it")
            }


        let createMember= await context.prisma.createMember({
                firstName,
                lastName,
                email,
                gender,
                phoneNumber,
                alternateNumber,
                DOB,
                address,
            })


            await context.prisma.createNotification({
                typeofOperation:'CREATED',
                impactedId:createMember.id,
                category:"MEMBER",
                owner:{connect:{id:userId}},
                createdAt:new Date(),
                updatedAt:new Date()
            })
           const getAllUsers= await context.prisma.users({});
           getAllUsers.forEach(async element => {
               console.log((parseInt(element.readNotificationCount) +1).toString());
               await context.prisma.updateUser({
                   data:{
                    readNotificationCount:(parseInt(element.readNotificationCount) +1).toString()
                   },
                   where:{
                       id:element.id
                   }
               })
           });
           return createMember;
        },
        createPackage:async(parent,{name,memberShipId,startDate,endDate,fees},context)=>{
            try{
                const userId=getUserId(context);
            const loggedInUser=  await context.prisma.user({id:userId});
                let memberData=await context.prisma.member({id:memberShipId});
                let packages= await context.prisma.createPackage({
                    name,
                    memberShipId:{connect:{id:memberShipId}},
                    startDate,
                    endDate,
                    fees
                });
                const today = new Date();
                const nextweek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
                console.log(today,nextweek,new Date(endDate))
                await context.prisma.updateMember({
                    data:{
                        status:(new Date(endDate)>nextweek ? "ACTIVE": ((new Date(endDate)> new Date() &&new Date(endDate)<= nextweek) ? "DANGER":"DEACTIVE"))
                    },
                    where:{
                        id:memberShipId
                    }
                });
                const date= new Date(packages.startDate);
                const endDates=new Date(packages.endDate);
                packages.startDate=date.getDate()+ '-'+ (date.getMonth() + 1) + '-'+ date.getFullYear();
                packages.endDate=endDates.getDate()+ '-'+ (endDates.getMonth() + 1) + '-'+ endDates.getFullYear();
                memberData.package=packages;
                await fetch('/.netlify/functions/sendemail', {
                    method: 'POST',
                    headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({receipent,loggedInUser,createdData:memberData,typeofOperation:"CREATED",category:"Member"})
      });
                return packages;

            }
            catch(error) {
                console.log(error);
            }
           


        },
        signUp:async(parent,{username,email,password},context)=> {
            const encryptedpassword=await bcrypt.hash(password,10);
            const user= await context.prisma.createUser({
                username,
                email,
                password:encryptedpassword
            });

            const token=jwt.sign({userId:user.id},APP_SECRET);
            return {
                token,
                user
            }
        },
        login:async(parent,{email,password},context)=>{
            const user = await context.prisma.user({email:email});
            if(!user)
                throw new Error('No such User Found')
             const valid = await bcrypt.compare(password,user.password);
             if(!valid)
                throw new Error('Invalid Password');
             const token =  jwt.sign({userId:user.id},APP_SECRET);
             return {
                 token,
                 user
             }   
        },
        forgetPassword:async(parent,{username,email,password},context)=>{
            console.log(username,email);
            const userExists = await context.prisma.users({
                    where:{
                        email:email,
                        username:username
                       
                    }
                });
                const user=userExists[0];
                console.log(user);
            if(!user)
                throw new Error('No such User Found')
                const encryptedpassword=await bcrypt.hash(password,10);
            const updatedUser= await context.prisma.updateUser({
                data:{
                    password:encryptedpassword
                },
                where: {
                    id:user.id
                } 
            })
             return updatedUser;  
        },
        updateUser:async(parent,{email,password},context)=>{
            const userId = getUserId(context);
            const userExists=await context.prisma.user({email});
            console.log("User",userExists)
            if(!userExists)
                throw new Error("User Not Found");
            const encryptedpassword=await bcrypt.hash(password,10);
            const updateUser= await context.prisma.updateUser({
                    data:{
                     password:encryptedpassword
                    },
                    where:{
                        email:email
                    }
                });
                console.log("User",updateUser)
                await context.prisma.createNotification({
                    typeofOperation:'UPDATED',
                    impactedId:updateUser.id,
                    category:"USER",
                    owner:{connect:{id:userId}},
                    createdAt:new Date(),
                    updatedAt:new Date()
                })
               const getAllUsers= await context.prisma.users({});
               getAllUsers.forEach(async element => {
                   console.log((parseInt(element.readNotificationCount) +1).toString());
                   await context.prisma.updateUser({
                       data:{
                        readNotificationCount:(parseInt(element.readNotificationCount) +1).toString()
                       },
                       where:{
                           id:element.id
                       }
                   })
               });

            return updateUser;
           
        },
        updateMemberPackage:async(parent,{email,name,memberShipId,startDate,endDate,fees,previousPackageId},context)=>{
            console.log("Member",email,name,memberShipId,startDate,endDate,fees,previousPackageId)
            const userId = getUserId(context);
            const memberExists=await context.prisma.member({email});
            if(!memberExists)
                throw new Error("User Not Found");
            const updatePackage= await context.prisma.updateManyPackages({
                    data:{
                    name,
                    startDate,
                    endDate,
                    fees
                    },
                    where:{
                        id:previousPackageId
                        }
                });
                const today = new Date();
                const nextweek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
                await context.prisma.updateMember({
                    data:{
                        status:(new Date(endDate)>nextweek ? "ACTIVE": ((new Date(endDate)> new Date() &&new Date(endDate)<= nextweek) ? "DANGER":"DEACTIVE"))
                    },
                    where:{
                        email
                    }
                });
                console.log("Member Package",updatePackage)
                await context.prisma.createNotification({
                    typeofOperation:'UPDATED',
                    impactedId:memberShipId,
                    category:"MEMBER",
                    owner:{connect:{id:userId}},
                    createdAt:new Date(),
                    updatedAt:new Date()
                })
               const getAllUsers= await context.prisma.users({});
               getAllUsers.forEach(async element => {
                   console.log((parseInt(element.readNotificationCount) +1).toString());
                   await context.prisma.updateUser({
                       data:{
                        readNotificationCount:(parseInt(element.readNotificationCount) +1).toString()
                       },
                       where:{
                           id:element.id
                       }
                   })
               });

            return memberExists;
           
        }

    },
    Member:{
        package:async(parent,args,context)=>{
            console.log(parent.id)
            let data= await context.prisma.member({id:parent.id}).package();
           
            return data.map(item=>{
               const date= new Date(item.startDate);
               const endDate=new Date(item.endDate);
               item.startDate=date.getDate()+ '-'+ (date.getMonth() + 1) + '-'+ date.getFullYear();
               item.endDate=endDate.getDate()+ '-'+ (endDate.getMonth() + 1) + '-'+ endDate.getFullYear();
                return item;
            });
        }
    },
    Package:{
        memberShipId:async(parent,args,context)=>{
            console.log(parent.id)
            return await context.prisma.package({id:parent.id}).memberShipId();
        }
    },
    Notification:{
        owner:async(parent,args,context)=>{
            console.log(parent.id)
            return await context.prisma.notification({id:parent.id}).owner();
        }
    },
    Subscription :{
        memberInformation: {
            subscribe:async (parent,args,context)=>{
                return await context.prisma.$subscribe.member({
                
                        mutation_in:['CREATED','UPDATED']
                
                }).node()
            },
            resolve:payload=>{
                return payload
            }
        }
    }
    

}

const server=new ApolloServer({
    typeDefs,
    resolvers,
    playground: true,
    introspection: true,
    context:request=>{
        return {
            ...request,
          prisma
        }
    }
});

exports.handler = server.createHandler({
    cors: {
      origin: '*',
      methods:'GET,POST,PUT,OPTIONS, HEAD',
      credentials: true,
    },
  });

cron.schedule("* 17 * * *",function() {
    console.log("RUNNING A tASK EVERY mINUTE ");
const query=`
query getPackageBeforeWeek {
    data:getPackageBeforeWeek {
      id
      startDate
      endDate
      fees
      memberShipId {
        firstName
        lastName
        email
        gender
        phoneNumber
        alternateNumber
        DOB
      }
      
    }
  }
`;
request('/.netlify/functions/index',query).then(async function (results) {
        if (results.errors) {
         conssole.log("errror");
          return
        }
        results.data.forEach((result)=>{
            const date= new Date(result.startDate);
            const endDate=new Date(result.endDate);
            const dob=new Date(result.memberShipId.DOB);
            result.startDate=date.getDate()+ '-'+ (date.getMonth() + 1) + '-'+ date.getFullYear();
            result.endDate=endDate.getDate()+ '-'+ (endDate.getMonth() + 1) + '-'+ endDate.getFullYear();
            result.memberShipId.DOB=dob.getDate()+ '-'+ (dob.getMonth() + 1) + '-'+ dob.getFullYear();
        })
       
        var user = results.data;
        await fetch('https://objective-albattani-e15dce.netlify.app/.netlify/functions/sendemail', {
            method: 'POST',
            headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({receipent,loggedInUser:null,createdData:user,typeofOperation:null,category:"Member's"})
});
        // await SendEmail(receipent,null,user,null,"Member's");
        console.log(user);
      })
    
})


//   query getAllMembers {
//     customers:getAllMembers {
//     id
//     firstName
//     lastName
//     email
//     gender
//     phoneNumber
//     alternateNumber
//     DOB
//     package {
//       name
//       startDate
//       endDate
//     }  
//     }
//   }
