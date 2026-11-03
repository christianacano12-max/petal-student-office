require('dotenv').config();
const readline=require('readline'); const bcrypt=require('bcryptjs'); const pool=require('./db');
const ask=q=>new Promise(resolve=>{const r=readline.createInterface({input:process.stdin,output:process.stdout});r.question(q,a=>{r.close();resolve(a.trim())})});
function hidden(q){return new Promise(resolve=>{const i=process.stdin,o=process.stdout;o.write(q);i.resume();i.setRawMode(true);let v='';
const key=b=>{const c=b.toString();if(c==='\u0003')process.exit();if(c==='\r'||c==='\n'){i.setRawMode(false);i.pause();i.removeListener('data',key);o.write('\n');resolve(v)}else if(c==='\u007f'||c==='\u0008')v=v.slice(0,-1);else if(c>=' ')v+=c};i.on('data',key)})}
(async()=>{try{const name=await ask('Administrator full name: ');const email=(await ask('Email: ')).toLowerCase();const password=await hidden('Password (minimum 10 characters, hidden): ');
if(!name||!email||password.length<10)throw Error('Enter a name, email and password with at least 10 characters.');
const hash=await bcrypt.hash(password,12);await pool.query('INSERT INTO admins(full_name,email,password_hash) VALUES($1,$2,$3)',[name,email,hash]);console.log('Administrator created. Sign in through the dashboard.')}
catch(e){console.error('Could not create administrator:',e.message);process.exitCode=1}finally{await pool.end()}})();
