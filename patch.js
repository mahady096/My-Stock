// ==========================================
// 📦 patch.js – একক কমান্ডে সব উন্নতি এপ্লাই করুন
//    scanner.js: calcPSAR সরানো, calculateParabolicSAR ব্যবহার
//    ui.js: কনসোল ভিউয়ার সম্পূর্ণ রিমুভ
//    index.html: কনসোল বাটন ও প্যানেল রিমুভ
//    portfolio.js: alert() → showToast() প্রতিস্থাপন
// ==========================================

const fs = require('fs');
const path = require('path');

// ==========================================
// ১. scanner.js – calcPSAR সরানো
// ==========================================
function patchScanner() {
    const filePath = path.join(__dirname, 'scanner.js');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️ scanner.js not found, skipping...');
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    // পুরো calcPSAR ফাংশন ডিলিট (রেগুলার এক্সপ্রেশন দিয়ে)
    content = content.replace(
        /function calcPSAR\([^)]*\)\s*\{[\s\S]*?\n\}/,
        '// calcPSAR সরানো হয়েছে – calculateParabolicSAR ব্যবহার করুন (core.js থেকে)'
    );

    // সব calcPSAR কলকে calculateParabolicSAR দিয়ে প্রতিস্থাপন
    content = content.replace(/calcPSAR\(/g, 'calculateParabolicSAR(');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ scanner.js patched (calcPSAR removed, calculateParabolicSAR used)');
}

// ==========================================
// ২. ui.js – কনসোল ভিউয়ার সম্পূর্ণ রিমুভ
// ==========================================
function patchUi() {
    const filePath = path.join(__dirname, 'ui.js');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️ ui.js not found, skipping...');
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    // কনসোল ভিউয়ার ব্লক ডিলিট
    const consoleBlockRegex = /\/\/ ==========================================\n\/\/ 18\. কনসোল লগ ভিউয়ার[\s\S]*?\/\/ ==========================================/;
    content = content.replace(consoleBlockRegex, '');

    // যদি কোনো অবশিষ্ট ফাংশন কল থাকে (যেমন initConsoleViewer), সেটাও সরান
    content = content.replace(/initConsoleViewer\(\);/g, '');
    content = content.replace(/function initConsoleViewer\(\)\s*\{[\s\S]*?\n\}/g, '');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ ui.js patched (console viewer removed)');
}

// ==========================================
// ৩. index.html – কনসোল বাটন ও প্যানেল রিমুভ
// ==========================================
function patchIndexHtml() {
    const filePath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️ index.html not found, skipping...');
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    // কনসোল বাটন ডিলিট
    content = content.replace(
        /<!-- Console Log Viewer Button -->[\s\S]*?<button id="toggle-console-btn"[^>]*>.*?<\/button>/,
        ''
    );

    // কনসোল প্যানেল ডিলিট
    content = content.replace(
        /<!-- Console Log Panel -->[\s\S]*?<div id="console-panel"[^>]*>[\s\S]*?<\/div>/,
        ''
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ index.html patched (console button & panel removed)');
}

// ==========================================
// ৪. portfolio.js – alert() → showToast()
// ==========================================
function patchPortfolio() {
    const filePath = path.join(__dirname, 'portfolio.js');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️ portfolio.js not found, skipping...');
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    // নির্দিষ্ট alert বার্তাগুলো showToast দিয়ে প্রতিস্থাপন
    const replacements = [
        // Buy success
        {
            from: /alert\(`✅ \$\{shareName\} purchased successfully!`\)/g,
            to: `showToast(\`✅ \${shareName} purchased successfully!\`, 'success')`
        },
        // Buy error
        {
            from: /alert\("Failed to save purchase!"\)/g,
            to: `showToast('❌ Failed to save purchase!', 'error')`
        },
        // Sell success
        {
            from: /alert\(`✅ সফলভাবে \$\{totalSoldSuccessfully\} টি \$\{ticker\} শেয়ার বিক্রয় রেকর্ড করা হয়েছে。`\)/g,
            to: `showToast(\`✅ \${totalSoldSuccessfully} shares of \${ticker} sold successfully!\`, 'success')`
        },
        // Sell error
        {
            from: /alert\("বিক্রি সম্পন্ন করা যায়নি。"\)/g,
            to: `showToast('❌ Sell failed', 'error')`
        },
        // Batch sell success
        {
            from: /alert\(`✅ \$\{processedCount\} sale\(s\) processed successfully!`\)/g,
            to: `showToast(\`✅ \${processedCount} sale(s) processed successfully!\`, 'success')`
        },
        // Batch sell error
        {
            from: /alert\("Failed to execute batch sales."\)/g,
            to: `showToast('❌ Failed to execute batch sales.', 'error')`
        },
        // Dividend save error
        {
            from: /alert\('Error saving'\)/g,
            to: `showToast('❌ Error saving dividend', 'error')`
        },
        // Dividend delete
        {
            from: /alert\('Delete\?'\)/g,
            to: `showToast('🗑️ Deleted successfully!', 'info')`
        },
        // Buy history edit
        {
            from: /alert\("Updated. Refresh to see changes."\)/g,
            to: `showToast('✅ Updated successfully!', 'success')`
        },
        // Buy history delete
        {
            from: /alert\("Deleted"\)/g,
            to: `showToast('🗑️ Deleted successfully!', 'info')`
        },
        // Sell history edit (if any)
        {
            from: /alert\("Updated"\)/g,
            to: `showToast('✅ Updated successfully!', 'success')`
        }
    ];

    for (const { from, to } of replacements) {
        content = content.replace(from, to);
    }

    // যে alert গুলো showToast-এ রূপান্তরিত হয়নি, সেগুলোকে ইনফো টোস্টে রূপান্তর
    // উদাহরণ: সাধারণ alert("Something")
    content = content.replace(
        /alert\((["'])([^"']*)\1\)/g,
        (match, quote, msg) => {
            // যদি এটি কোনো কনফর্ম বা প্রম্পট না হয়, তাহলে showToast
            if (!msg.includes('?')) {
                return `showToast(${quote}${msg}${quote}, 'info')`;
            }
            return match; // কনফর্ম থাকলে রেখে দিই
        }
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ portfolio.js patched (alert → showToast)');
}

// ==========================================
// ৫. ui.js – alert() → showToast() (ব্যাকআপ ও ডিলেট)
// ==========================================
function patchUiAlerts() {
    const filePath = path.join(__dirname, 'ui.js');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️ ui.js not found for alert patching, skipping...');
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    const replacements = [
        // Backup download
        {
            from: /alert\("লগইন করুন!"\)/g,
            to: `showToast('Please login first', 'error')`
        },
        {
            from: /alert\(`✅ সফল! \$\{buyData\.length \+ sellData\.length\} টি রেকর্ড ডাউনলোড হয়েছে।`\)/g,
            to: `showToast('✅ Backup downloaded successfully!', 'success')`
        },
        {
            from: /alert\("ব্যাকআপ নিতে ব্যর্থ"\)/g,
            to: `showToast('❌ Backup failed', 'error')`
        },
        // Upload
        {
            from: /alert\("লগইন করুন!"\)/g,
            to: `showToast('Please login first', 'error')`
        },
        {
            from: /alert\("✅ ডাটা রিস্টোর করা হয়েছে!"\)/g,
            to: `showToast('✅ Data restored successfully!', 'success')`
        },
        {
            from: /alert\("❌ ফাইল আপলোড ব্যর্থ"\)/g,
            to: `showToast('❌ Upload failed', 'error')`
        },
        // Delete portfolio
        {
            from: /alert\("দয়া করে আগে লগইন করুন!"\)/g,
            to: `showToast('Please login first', 'error')`
        },
        {
            from: /alert\("পোর্টফোলিও মোছার কাজ শুরু হয়েছে, দয়া করে কিছুক্ষণ অপেক্ষা করুন\.\.\."\)/g,
            to: `showToast('⏳ Deleting portfolio...', 'info')`
        },
        {
            from: /alert\("আপনার পোর্টফোলিওর সমস্ত ডাটা সফলভাবে মুছে ফেলা হয়েছে!"\)/g,
            to: `showToast('✅ Portfolio deleted successfully!', 'success')`
        },
        {
            from: /alert\("দুঃখিত, পোর্টফোলিওটি মুছে ফেলা সম্ভব হয়নি。"\)/g,
            to: `showToast('❌ Failed to delete portfolio', 'error')`
        }
    ];

    for (const { from, to } of replacements) {
        content = content.replace(from, to);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ ui.js alert patched (additional alerts → showToast)');
}

// ==========================================
// 🚀 মেইন ফাংশন – সব প্যাচ রান
// ==========================================
function runAllPatches() {
    console.log('🔧 Starting patch application...\n');

    patchScanner();
    patchUi();
    patchIndexHtml();
    patchPortfolio();
    patchUiAlerts();

    console.log('\n✅ All patches applied successfully!');
    console.log('📝 Changes made:');
    console.log('   - scanner.js: calcPSAR removed, calculateParabolicSAR used');
    console.log('   - ui.js: console viewer completely removed');
    console.log('   - index.html: console button & panel removed');
    console.log('   - portfolio.js & ui.js: all alert() → showToast()');
    console.log('\n🔄 Please refresh your browser to see changes.');
}

// ==========================================
// রান
// ==========================================
runAllPatches();