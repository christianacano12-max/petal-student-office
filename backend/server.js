require('dotenv').config();
const express=require('express'),path=require('path'),session=require('express-session');
const PgStore=require('connect-pg-simple')(session),bcrypt=require('bcryptjs');
const pool=require('./db'),auth=require('./auth'),app=express();
const port=Number(process.env.PORT||3000);
if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw Error('Set SESSION_SECRET in .env (at least 32 characters).');
app.disable('x-powered-by');

// Important: Trust Render's reverse proxy for secure sessions
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(session({store:new PgStore({pool,createTableIfMissing:true,tableName:'user_sessions'}),
 name:'petal.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}}));
const api=express.Router(),wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const log=(admin,student,action,description)=>pool.query(
 'INSERT INTO activity_logs(admin_id,student_id,action,description) VALUES($1,$2,$3,$4)',[admin,student||null,action,description]);
api.post('/auth/login',wrap(async(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),pass=String(req.body.password||'');
if(!email||!pass)return res.status(400).json({message:'Email and password are required.'});
const r=await pool.query('SELECT id,full_name,email,password_hash FROM admins WHERE email=$1',[email]);
if(!r.rowCount||!(await bcrypt.compare(pass,r.rows[0].password_hash)))return res.status(401).json({message:'Incorrect email or password.'});
req.session.regenerate(err=>{if(err)return res.status(500).json({message:'Could not start session.'});
req.session.admin={id:r.rows[0].id,full_name:r.rows[0].full_name,email:r.rows[0].email};
req.session.save(e=>e?res.status(500).json({message:'Could not save session.'}):res.json({admin:req.session.admin}));});}));
api.get('/auth/me',auth,(req,res)=>res.json({admin:req.session.admin}));
api.post('/auth/logout',auth,(req,res)=>req.session.destroy(e=>e?res.status(500).json({message:'Sign-out failed.'}):(res.clearCookie('petal.sid'),res.json({message:'Signed out.'}))));
api.use(auth);
api.get('/dashboard',wrap(async(req,res)=>{const [s,a,x,l]=await Promise.all([
pool.query('SELECT COUNT(*)::int n FROM students'),
pool.query("SELECT COUNT(*) FILTER(WHERE status='Present')::int present,COUNT(*) FILTER(WHERE status='Late')::int late,COUNT(*) FILTER(WHERE status='Absent')::int absent FROM attendance WHERE attendance_date=CURRENT_DATE"),
pool.query("SELECT COUNT(*)::int n FROM sanctions WHERE status<>'Resolved'"),
pool.query('SELECT l.*,s.full_name student_name FROM activity_logs l LEFT JOIN students s ON s.id=l.student_id ORDER BY l.created_at DESC LIMIT 7')]);
res.json({students:s.rows[0].n,attendance:a.rows[0],sanctions:x.rows[0].n,recent:l.rows});}));
api.get('/students',wrap(async(req,res)=>{const q='%'+String(req.query.q||'').trim()+'%';res.json((await pool.query(
"SELECT s.*,(SELECT COUNT(*)::int FROM sanctions z WHERE z.student_id=s.id AND z.status<>'Resolved') active_sanctions FROM students s WHERE s.full_name ILIKE $1 OR s.student_number ILIKE $1 OR s.course ILIKE $1 ORDER BY s.full_name",[q])).rows)}));
api.post('/students',wrap(async(req,res)=>{const {student_number,full_name,course,year_level,email,phone}=req.body;if(!student_number||!full_name||!course||!year_level)return res.status(400).json({message:'Student number, name, course and year are required.'});
const r=await pool.query('INSERT INTO students(student_number,full_name,course,year_level,email,phone) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[student_number,full_name,course,year_level,email||null,phone||null]);await log(req.session.admin.id,r.rows[0].id,'Student added','Added '+full_name);res.status(201).json(r.rows[0])}));
api.put('/students/:id',wrap(async(req,res)=>{const {student_number,full_name,course,year_level,email,phone}=req.body;const r=await pool.query('UPDATE students SET student_number=$1,full_name=$2,course=$3,year_level=$4,email=$5,phone=$6,updated_at=NOW() WHERE id=$7 RETURNING *',[student_number,full_name,course,year_level,email||null,phone||null,req.params.id]);if(!r.rowCount)return res.status(404).json({message:'Student not found.'});await log(req.session.admin.id,r.rows[0].id,'Student updated','Updated '+full_name);res.json(r.rows[0])}));
api.delete('/students/:id',wrap(async(req,res)=>{const r=await pool.query('DELETE FROM students WHERE id=$1 RETURNING full_name',[req.params.id]);if(!r.rowCount)return res.status(404).json({message:'Student not found.'});await log(req.session.admin.id,null,'Student deleted','Deleted student '+r.rows[0].full_name);res.json({message:'Deleted.'})}));
api.get('/attendance',wrap(async(req,res)=>res.json((await pool.query('SELECT a.*,s.full_name,s.student_number FROM attendance a JOIN students s ON s.id=a.student_id ORDER BY attendance_date DESC,a.id DESC LIMIT 300')).rows)));
api.post('/attendance',wrap(async(req,res)=>{const {student_id,attendance_date,status,remarks}=req.body;if(!student_id||!attendance_date||!['Present','Late','Absent','Excused'].includes(status))return res.status(400).json({message:'Select a student, date and valid status.'});
const r=await pool.query("INSERT INTO attendance(student_id,attendance_date,status,remarks,recorded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,remarks=EXCLUDED.remarks,recorded_by=EXCLUDED.recorded_by RETURNING *",[student_id,attendance_date,status,remarks||null,req.session.admin.id]);await log(req.session.admin.id,student_id,'Attendance recorded','Marked '+status+' on '+attendance_date);res.status(201).json(r.rows[0])}));
api.delete('/attendance/:id',wrap(async(req,res)=>{const r=await pool.query('DELETE FROM attendance WHERE id=$1 RETURNING student_id',[req.params.id]);if(!r.rowCount)return res.status(404).json({message:'Record not found.'});await log(req.session.admin.id,r.rows[0].student_id,'Attendance deleted','Deleted an attendance record');res.json({message:'Deleted.'})}));
api.get('/sanctions',wrap(async(req,res)=>res.json((await pool.query('SELECT x.*,s.full_name,s.student_number FROM sanctions x JOIN students s ON s.id=x.student_id ORDER BY sanction_date DESC,x.id DESC')).rows)));
api.post('/sanctions',wrap(async(req,res)=>{const {student_id,violation,description,severity,sanction_action,status,sanction_date}=req.body;if(!student_id||!violation||!sanction_action||!['Minor','Major','Grave'].includes(severity))return res.status(400).json({message:'Complete student, violation, severity and action.'});
const r=await pool.query('INSERT INTO sanctions(student_id,violation,description,severity,sanction_action,status,sanction_date,issued_by) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_DATE),$8) RETURNING *',[student_id,violation,description||null,severity,sanction_action,status||'Pending',sanction_date||null,req.session.admin.id]);await log(req.session.admin.id,student_id,'Sanction recorded','Recorded '+severity+' case: '+violation);res.status(201).json(r.rows[0])}));
api.patch('/sanctions/:id',wrap(async(req,res)=>{if(!['Pending','Under Review','Resolved'].includes(req.body.status))return res.status(400).json({message:'Invalid status.'});const r=await pool.query('UPDATE sanctions SET status=$1 WHERE id=$2 RETURNING *',[req.body.status,req.params.id]);if(!r.rowCount)return res.status(404).json({message:'Sanction not found.'});await log(req.session.admin.id,r.rows[0].student_id,'Sanction updated','Status changed to '+req.body.status);res.json(r.rows[0])}));
api.delete('/sanctions/:id',wrap(async(req,res)=>{const r=await pool.query('DELETE FROM sanctions WHERE id=$1 RETURNING student_id',[req.params.id]);if(!r.rowCount)return res.status(404).json({message:'Sanction not found.'});await log(req.session.admin.id,r.rows[0].student_id,'Sanction deleted','Deleted a sanction record');res.json({message:'Deleted.'})}));
api.get('/activities',wrap(async(req,res)=>res.json((await pool.query('SELECT l.*,a.full_name admin_name,s.full_name student_name FROM activity_logs l LEFT JOIN admins a ON a.id=l.admin_id LEFT JOIN students s ON s.id=l.student_id ORDER BY l.created_at DESC LIMIT 400')).rows)));
api.get('/admins',wrap(async(req,res)=>res.json((await pool.query('SELECT id,full_name,email,created_at FROM admins ORDER BY created_at')).rows)));
api.post('/admins',wrap(async(req,res)=>{const {full_name,email,password}=req.body;if(!full_name||!email||!password||password.length<10)return res.status(400).json({message:'Name, email and password (10+ characters) are required.'});try{const hash=await bcrypt.hash(password,12);const r=await pool.query('INSERT INTO admins(full_name,email,password_hash) VALUES($1,$2,$3) RETURNING id,full_name,email,created_at',[full_name,email.trim().toLowerCase(),hash]);await log(req.session.admin.id,null,'Administrator added','Created admin '+email);res.status(201).json(r.rows[0])}catch(e){if(e.code==='23505')return res.status(409).json({message:'That administrator email already exists.'});throw e}}));
app.use('/api',api);app.use(express.static(path.join(__dirname,'../frontend')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../frontend/index.html')));
app.use((e,req,res,next)=>{console.error(e);res.status(500).json({message:'Something went wrong. Check the server terminal.'})});
pool.query('SELECT 1').then(()=>app.listen(port,()=>console.log('Petal is ready at http://localhost:'+port))).catch(e=>{console.error('PostgreSQL connection failed:',e.message);process.exit(1)});
