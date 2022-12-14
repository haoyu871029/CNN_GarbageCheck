package com.ncku.photogrametry;

public class MainActivity extends AppCompatActivity
        implements View.OnClickListener {
    DBHelper dbHelper;
    static final String tb_categories = "categories";
    static final String tb_firstuse = "firstuse";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        Stetho.initializeWithDefaults(this);
        dbHelper = new DBHelper(this);
        dbinit();

        ImageView img = findViewById(R.id.imageView2);
        TextView header = findViewById(R.id.textView2);
        TextView description = findViewById(R.id.textView);
        img.setOnClickListener(this);
        header.setOnClickListener(this);
        description.setOnClickListener(this);

        getCameraPermission();
    }

    @Override
    public void onClick(View v) {
        if(!firstuse()) {
            Intent intent = new Intent();
            intent.setClass(MainActivity.this, Help.class);
            startActivity(intent);
        }
        else {
            Intent intent = new Intent();
            intent.setClass(MainActivity.this, DoApplication.class);
            startActivity(intent);
        }
    }

    public void getCameraPermission()
    {
        if(ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED)
        {
            ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.CAMERA},1);
        }
    }

    public boolean firstuse()
    {
        Cursor cursor = dbHelper.used();
        cursor.moveToNext();
        if(cursor.getInt(cursor.getColumnIndex("use"))==1)
        {
            return true;
        }
        return false;
    }

    private void dbinit()
    {
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_categories,"categories","cardboard"))
            dbHelper.addDatatoCategory("cardboard",0);
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_categories,"categories","glass"))
            dbHelper.addDatatoCategory("glass",0);
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_categories,"categories","metal"))
            dbHelper.addDatatoCategory("metal",0);
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_categories,"categories","paper"))
            dbHelper.addDatatoCategory("paper",0);
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_categories,"categories","plastic"))
            dbHelper.addDatatoCategory("plastic",0);
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_categories,"categories","trash"))
            dbHelper.addDatatoCategory("trash",0);
        if(!dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_firstuse,"use","0"))
            if(dbHelper.CheckIsDataAlreadyInDBorNot(DBHelper.tb_firstuse,"use","1"))
                return;
            else
                dbHelper.addDatatoFirstuese(0);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // 設置要用哪個menu檔做為選單
        getMenuInflater().inflate(R.menu.menu_main, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if(firstuse()) {
            Intent intent = new Intent();
            intent.setClass(MainActivity.this, Help.class);
            startActivity(intent);
        }
        else {
            return true;
        }
        return true;
    }
}

public class Classifier extends AppCompatActivity {

    Uri imgUri;
    ImageView imv;
    TextView info;
    int channel = 3;
    int inputimagewidht = 224;
    int inputimageheight = 224;
    int modelinputsize = inputimagewidht * inputimageheight * channel;
    float resultarray[][] = new float[1][6];
    Interpreter model;
    List<String> labellist;
    Bitmap bmp = null;
    DBHelper dbHelper;
    Bitmap oldbmp=null;
    boolean diffbmp = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_classifier);

        dbHelper = new DBHelper(this);

        imv = findViewById(R.id.imgresultpicture);
        info = findViewById(R.id.tvshowresult);
        AssetManager assetManager = getAssets();

        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_NOSENSOR);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        if (android.os.Build.VERSION.SDK_INT > 9) {
            StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
            StrictMode.setThreadPolicy(policy);
        }
        try {
            model = new Interpreter(loadModelFile());
            labellist = loadLabelList(assetManager,"labels2.txt");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void onGet(View v) {
        if (ActivityCompat.checkSelfPermission(this,
                Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this, new String[]
                            {Manifest.permission.WRITE_EXTERNAL_STORAGE}, 200);
        } else {
            savePhoto();
        }
    }

    public void onPick(View v) {
        Intent it = new Intent(Intent.ACTION_GET_CONTENT);
        it.setType("image/*");
        startActivityForResult(it, 101);
    }

    public void onShow(View v)
    {
        if(bmp != null && diffbmp)
            RunModel(bmp);
    }

    @Override
    protected void onActivityResult(int reqCode, int resCode, Intent data) {
        super.onActivityResult(reqCode, resCode, data);
        if (resCode == Activity.RESULT_OK) {
            switch (reqCode) {
                case 100:
                    Intent it = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, imgUri);
                    sendBroadcast(it);
                    break;
                case 101:
                    imgUri = data.getData();
                    break;
            }
            ShowImg();
        } else {
            Toast.makeText(this, "沒有照片", Toast.LENGTH_LONG).show();
        }
    }

    private void savePhoto() {

        //自動在儲存空間產生一個圖片編號
        imgUri = getContentResolver().insert(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI, new ContentValues());
        Intent it = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        it.putExtra(MediaStore.EXTRA_OUTPUT, imgUri);

        startActivityForResult(it, 100);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        if (requestCode == 200) {
            if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                savePhoto();
            } else {

            }
        }
    }

    void ShowImg() {
        int iw, ih, vw, vh;
        boolean needRotate;

        BitmapFactory.Options option = new BitmapFactory.Options();
        option.inJustDecodeBounds = true;

        try {
            BitmapFactory.decodeStream(getContentResolver().openInputStream(imgUri), null, option);

        } catch (IOException e) {
            Toast.makeText(this, "無法讀取照片", Toast.LENGTH_LONG).show();
            return;
        }

        iw = option.outWidth;
        ih = option.outHeight;
        vw = imv.getWidth();
        vh = imv.getHeight();
        int nw = 224;
        int nh = 224;

        int scaleFactor;
        float sw;
        float sh;

        sw = ((float) nw) / iw;
        sh = ((float) nh) / ih;

        if (iw > ih) {
            needRotate = true;
        }
        else {
            needRotate = false;
        }
        scaleFactor = Math.min(ih / vw, iw / vh);

        option.inJustDecodeBounds = false;
        //option.inSampleSize = scaleFactor;

        try {
            bmp = BitmapFactory.decodeStream(getContentResolver()
                    .openInputStream(imgUri), null, option);
        } catch (IOException e) {
            Toast.makeText(this, "無法顯示照片", Toast.LENGTH_LONG).show();
        }

        if(oldbmp == null)
            oldbmp = bmp;
        else {
            if(oldbmp == bmp)
                diffbmp = false;
            else
                diffbmp = true;
        }

        Matrix matrix = new Matrix();
        matrix.postScale(sw,sh);
        if (needRotate)
            matrix.postRotate(90);

        bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(),
                bmp.getHeight(), matrix, true);

        imv.setImageBitmap(bmp);

    }

    private MappedByteBuffer loadModelFile() throws IOException {
        AssetFileDescriptor fileDescriptor = getAssets().openFd("converted_model6.tflite");
        FileInputStream input = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = input.getChannel();
        long startOffset = fileDescriptor.getStartOffset();
        long declaredLength = fileDescriptor.getDeclaredLength();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
    }

    private ByteBuffer convertBitmapToByteBuffer(Bitmap bitmap)
    {
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(4*modelinputsize);
        byteBuffer.order(ByteOrder.nativeOrder());
        int[] pixels = new int[inputimagewidht * inputimageheight];
        bitmap.getPixels(pixels,0,bitmap.getWidth(),0,0,bitmap.getWidth(),bitmap.getHeight());
        int pixel = 0;
        for(int i=0;i<inputimagewidht;i++) {
            for (int j = 0; j < inputimageheight; j++) {
                final int val = pixels[pixel++];
                byteBuffer.putFloat(((val >> 16) & 0xFF) / 255.f);
                byteBuffer.putFloat(((val >> 8) & 0xFF) / 255.f);
                byteBuffer.putFloat((val & 0xFF) / 255.f);
            }
        }

        return byteBuffer;
    }

    private void RunModel(Bitmap bitmap)
    {
        ByteBuffer modelinput = convertBitmapToByteBuffer(bitmap);
        float maxprob=0;
        int which=0;
        model.run(modelinput,resultarray);
        for(int i=0;i<6;i++)
        {
            if(resultarray[0][i]>maxprob) {
                maxprob = resultarray[0][i];
                which = i;
            }
        }
        maxprob *= 100;
        String str = "The item has " + maxprob + "% as a " + labellist.get(which) + "\n";
        info.setText(str);
        Cursor cursor;
        cursor = dbHelper.select(labellist.get(which));
        cursor.moveToNext();
        if(cursor.getCount()>0) {
            int count = cursor.getInt(cursor.getColumnIndex("count"));
            dbHelper.modify(labellist.get(which), count + 1);
        }
        if(diffbmp)
            diffbmp = false;
    }

    private List<String> loadLabelList(AssetManager assetManager, String labelPath) throws IOException {
        List<String> labelList = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(assetManager.open(labelPath)));
        String line;
        while ((line = reader.readLine()) != null) {
            labelList.add(line);
        }
        reader.close();
        return labelList;
    }
}

public class ClassifierNum extends AppCompatActivity {

    DBHelper dbHelper;
    //String[] strlist = new String[] {"paper","metal","plastic","styrofoam","glass"};
    String[] strlist = new String[] {"cardboard","glass","metal","paper","plastic","trash"};
    //String[] strlist = new String[] {"glass","metal","paper","plastic","trash"};
    int[] tvid = new int[] {R.id.tvpapernum, R.id.tvmetalnum, R.id.tvplasticnum,
            R.id.tvstyrofoamnum, R.id.tvglassnum, R.id.tvnormalnum};
    String str;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_classifiernum);

        TextView[] tvlist = new TextView[6];
        for(int i=0;i<tvid.length;i++)
        {
            tvlist[i]=findViewById(tvid[i]);
        }

        dbHelper = new DBHelper(this);
        Cursor cursor = null;
        for(int i=0;i<strlist.length;i++)
        {
            cursor = dbHelper.select(strlist[i]);
            if(cursor.getCount()>0) {
                cursor.moveToNext();
                str = cursor.getString(cursor.getColumnIndex("count"));
                tvlist[i].setText(str);
            }
        }
    }
}

public class ClassifierHelp extends AppCompatActivity
        implements View.OnClickListener {

    ImageView golastback;
    ImageView golast;
    FrameLayout last;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_classifier_help);

        golastback = findViewById(R.id.imgtolastback4);
        golastback.setOnClickListener(this);
        golast =findViewById(R.id.imgtolast4);
        golast.setOnClickListener(this);
        last = findViewById(R.id.frametolast4);
        last.setOnClickListener(this);
    }

    @Override
    public void onClick(View v) {
        if(v == golastback || v == golast || v == last)
        {
            finish();
        }
    }
}

public class TreeState extends AppCompatActivity {

    DBHelper dbHelper;
    //String[] strlist = new String[] {"paper","metal","plastic","styrofoam","glass"};
    String[] strlist = new String[] {"cardboard","glass","metal","paper","plastic","trash"};
    //String[] strlist = new String[] {"glass","metal","paper","plastic","trash"};
    int total;
    ImageView seed;
    ImageView tree1;
    ImageView tree2;
    ImageView tree3;
    ImageView tree4;
    ImageView tree5;
    ImageView tree6;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_treestate);

        dbHelper = new DBHelper(this);
        Cursor cursor;
        for(int i=0;i<strlist.length;i++)
        {
            cursor = dbHelper.select(strlist[i]);
            cursor.moveToNext();
            total += cursor.getInt(cursor.getColumnIndex("count"));
        }

        seed = findViewById(R.id.imgseed);
        tree1 = findViewById(R.id.imgtree1);
        tree2 = findViewById(R.id.imgtree2);
        tree3 = findViewById(R.id.imgtree3);
        tree4 = findViewById(R.id.imgtree4);
        tree5 = findViewById(R.id.imgtree5);
        tree6 = findViewById(R.id.imgtree6);

        changeTreeState();

    }

    private void changeTreeState(){
        if(total < 10){
            seed.setVisibility(View.VISIBLE);
            tree1.setVisibility(View.INVISIBLE);
            tree2.setVisibility(View.INVISIBLE);
            tree3.setVisibility(View.INVISIBLE);
            tree4.setVisibility(View.INVISIBLE);
            tree5.setVisibility(View.INVISIBLE);
            tree6.setVisibility(View.INVISIBLE);
        }
        else if(total <25){
            seed.setVisibility(View.INVISIBLE);
            tree1.setVisibility(View.VISIBLE);
            tree2.setVisibility(View.INVISIBLE);
            tree3.setVisibility(View.INVISIBLE);
            tree4.setVisibility(View.INVISIBLE);
            tree5.setVisibility(View.INVISIBLE);
            tree6.setVisibility(View.INVISIBLE);
        }
        else if(total <60){
            seed.setVisibility(View.INVISIBLE);
            tree1.setVisibility(View.INVISIBLE);
            tree2.setVisibility(View.VISIBLE);
            tree3.setVisibility(View.INVISIBLE);
            tree4.setVisibility(View.INVISIBLE);
            tree5.setVisibility(View.INVISIBLE);
            tree6.setVisibility(View.INVISIBLE);
        }
        else if(total <100){
            seed.setVisibility(View.INVISIBLE);
            tree1.setVisibility(View.INVISIBLE);
            tree2.setVisibility(View.INVISIBLE);
            tree3.setVisibility(View.VISIBLE);
            tree4.setVisibility(View.INVISIBLE);
            tree5.setVisibility(View.INVISIBLE);
            tree6.setVisibility(View.INVISIBLE);
        }
        else if(total <200){
            seed.setVisibility(View.INVISIBLE);
            tree1.setVisibility(View.INVISIBLE);
            tree2.setVisibility(View.INVISIBLE);
            tree3.setVisibility(View.INVISIBLE);
            tree4.setVisibility(View.VISIBLE);
            tree5.setVisibility(View.INVISIBLE);
            tree6.setVisibility(View.INVISIBLE);
        }
        else if(total <500){
            seed.setVisibility(View.INVISIBLE);
            tree1.setVisibility(View.INVISIBLE);
            tree2.setVisibility(View.INVISIBLE);
            tree3.setVisibility(View.INVISIBLE);
            tree4.setVisibility(View.INVISIBLE);
            tree5.setVisibility(View.VISIBLE);
            tree6.setVisibility(View.INVISIBLE);
        }
        else{
            seed.setVisibility(View.INVISIBLE);
            tree1.setVisibility(View.INVISIBLE);
            tree2.setVisibility(View.INVISIBLE);
            tree3.setVisibility(View.INVISIBLE);
            tree4.setVisibility(View.INVISIBLE);
            tree5.setVisibility(View.INVISIBLE);
            tree6.setVisibility(View.VISIBLE);
        }

    }
}

public class TotalNumAndState extends AppCompatActivity {

    DBHelper dbHelper;
    //String[] strlist = new String[] {"paper","metal","plastic","styrofoam","glass"};
    String[] strlist = new String[] {"cardboard","glass","metal","paper","plastic","trash"};
    //String[] strlist = new String[] {"glass","metal","paper","plastic","trash"};
    int total;
    TextView tvtotal;
    ImageView img;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_totalnumandstate);

        dbHelper = new DBHelper(this);
        Cursor cursor = null;
        for(int i=0;i<strlist.length;i++)
        {
            cursor = dbHelper.select(strlist[i]);
            cursor.moveToNext();
            total += cursor.getInt(cursor.getColumnIndex("count"));
        }

        tvtotal = findViewById(R.id.tvtotalnum);
        img = findViewById(R.id.imgtreestate);

        tvtotal.setText(Integer.toString(total));
        setImg();
    }

    private void setImg()
    {
        if(total < 10)
            drawtree(0);
        else if(total <25)
            drawtree(1);
        else if(total <60)
            drawtree(2);
        else if(total <100)
            drawtree(3);
        else if(total <200)
            img.setImageDrawable(getDrawable(R.drawable.ntree4));
        else if(total <500)
            img.setImageDrawable(getDrawable(R.drawable.ntree5));
        else
            img.setImageDrawable(getDrawable(R.drawable.ntree6));

    }

    private void drawtree(int i)
    {
        Bitmap bmp = null;
        if(i==0)
            bmp = BitmapFactory.decodeResource(getResources(), R.drawable.nseed);
        else if(i==1)
            bmp = BitmapFactory.decodeResource(getResources(), R.drawable.ntree1);
        else if(i==2)
            bmp = BitmapFactory.decodeResource(getResources(), R.drawable.ntree2);
        else if(i==3)
            bmp = BitmapFactory.decodeResource(getResources(), R.drawable.ntree3);

        img.setImageBitmap(bmp);
    }
}


public class DBHelper extends SQLiteOpenHelper {

    static final int DBversion = 1;
    static final String db_name= "RecycleCount";
    static final String tb_categories = "Categories";
    static final String tb_firstuse = "firstuse";

    public DBHelper(@Nullable Context context) {
        super(context, db_name, null, DBversion);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String cateTable = "CREATE TABLE IF NOT EXISTS " + tb_categories
                + "(categories TEXT, count INT)";

        db.execSQL(cateTable);

        String UseTable = "CREATE TABLE IF NOT EXISTS " + tb_firstuse
                + "(use INT)";
        db.execSQL(UseTable);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        String SQL = "DROP TABLE " + tb_categories;
        db.execSQL(SQL);
        String SQL2 = "DROP TABLE " + tb_firstuse;
        db.execSQL(SQL2);
    }


    public void addDatatoCategory(String categories, int count) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("categories", categories);
        values.put("count", count);
        db.insert(tb_categories, null, values);
    }

    public void addDatatoFirstuese(int use) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("use",use);
        db.insert(tb_firstuse, null, values);
    }

    public Cursor select(String categories)
    {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = null;
        cursor = db.rawQuery(" SELECT count FROM " + tb_categories + " WHERE categories=" + "'" + categories + "'", null);
        return cursor;
    }

    public void modify(String categories, int count) {
        SQLiteDatabase db = getWritableDatabase();
        db.execSQL(" UPDATE " + tb_categories + " SET count=" + count + " WHERE categories=" + "'" + categories + "'");
    }

    public Cursor used() {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = null;
        cursor = db.rawQuery(" SELECT use FROM "+ tb_firstuse,null);
        return cursor;
    }

    public void updateUse(int use)
    {
        SQLiteDatabase db = getWritableDatabase();
        db.execSQL(" UPDATE "+ tb_firstuse + " SET use=" + use);
    }

    public boolean CheckIsDataAlreadyInDBorNot(String TableName, String dbfield, String fieldValue) {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor=null;
        try {
            String Query = "SELECT * FROM " + TableName + " WHERE " + dbfield + " = " + "'" +fieldValue + "'";
            cursor = db.rawQuery(Query, null);
        } catch (Exception e) {
            return false;
        }
        if(cursor.getCount() <= 0){
            cursor.close();
            return false;
        }
        cursor.close();
        return true;
    }
}

public class DoApplication extends AppCompatActivity
        implements View.OnClickListener {

    ImageView tostate;
    ImageView toclassifier;
    ImageView tonum;
    ImageView totree;
    DBHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_doapplication);

        dbHelper = new DBHelper(this);
        Cursor cursor = dbHelper.used();
        cursor.moveToNext();
        if(cursor.getInt(cursor.getColumnIndex("use"))==0){
            dbHelper.updateUse(1);
        }

        tostate = findViewById(R.id.imgtostate);
        tostate.setOnClickListener(this);
        toclassifier = findViewById(R.id.imgtoclassifier);
        toclassifier.setOnClickListener(this);
        tonum = findViewById(R.id.imgtonum);
        tonum.setOnClickListener(this);
        totree = findViewById(R.id.imgtotree);
        totree.setOnClickListener(this);

    }

    @Override
    public void onClick(View v) {
        if(v == tostate)
        {
            Intent intent = new Intent();
            intent.setClass(DoApplication.this, TotalNumAndState.class);
            startActivity(intent);
        }
        else if(v == toclassifier)
        {
            Intent intent = new Intent();
            intent.setClass(DoApplication.this, Classifier.class);
            startActivity(intent);
        }
        else if(v == tonum)
        {
            Intent intent = new Intent();
            intent.setClass(DoApplication.this, ClassifierNum.class);
            startActivity(intent);
        }
        else if(v == totree)
        {
            Intent intent = new Intent();
            intent.setClass(DoApplication.this, TreeState.class);
            startActivity(intent);
        }
    }

public class Help extends AppCompatActivity
        implements View.OnClickListener {

    ImageView statehelp;
    ImageView classifierhelp;
    ImageView numhelp;
    ImageView treehelp;
    ImageView golastback;
    ImageView golast;
    ImageView gonextback;
    ImageView gonext;
    FrameLayout last;
    FrameLayout next;
    DBHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_help);

        dbHelper = new DBHelper(this);

        statehelp = findViewById(R.id.imgtohelpstate);
        statehelp.setOnClickListener(this);
        classifierhelp = findViewById(R.id.imgtohelpclassifier);
        classifierhelp.setOnClickListener(this);
        numhelp = findViewById(R.id.imgtohelpnum);
        numhelp.setOnClickListener(this);
        treehelp = findViewById(R.id.imgtohelptree);
        treehelp.setOnClickListener(this);
        golastback = findViewById(R.id.imgtolastback);
        golastback.setOnClickListener(this);
        golast =findViewById(R.id.imgtolast);
        golast.setOnClickListener(this);
        gonextback = findViewById(R.id.imgtonextback);
        gonextback.setOnClickListener(this);
        gonext =findViewById(R.id.imgtonext);
        gonext.setOnClickListener(this);
        last = findViewById(R.id.frametolast);
        last.setOnClickListener(this);

        if(!firstuse()) {
            AlertDialog.Builder bdr = new AlertDialog.Builder(this);
            bdr.setTitle("歡迎");
            bdr.setMessage("此頁面為說明頁面\n按右箭頭即可跳過\n之後開始即會跳過此頁面\n若需查看說明\n請按右上角MenuBar");
            bdr.show();
        }
        else {
            gonextback.setVisibility(View.INVISIBLE);
            gonext.setVisibility(View.INVISIBLE);
        }
    }

    @Override
    public void onClick(View v) {
        if(v == golastback || v == golast || v == last)
        {
            finish();
        }
        else if((v == gonextback || v== gonext || v== next) && !firstuse())
        {
            Intent intent = new Intent();
            intent.setClass(Help.this, DoApplication.class);
            startActivity(intent);
        }
        else if(v == statehelp)
        {
            Intent intent = new Intent();
            intent.setClass(Help.this, Statehelp.class);
            startActivity(intent);
        }
        else if(v == classifierhelp)
        {
            Intent intent = new Intent();
            intent.setClass(Help.this, ClassifierHelp.class);
            startActivity(intent);
        }
        else if(v == numhelp)
        {
            Intent intent = new Intent();
            intent.setClass(Help.this, NumHelp.class);
            startActivity(intent);
        }
        else if(v == treehelp)
        {
            Intent intent = new Intent();
            intent.setClass(Help.this, TreeHelp.class);
            startActivity(intent);
        }
    }

    public boolean firstuse()
    {
        Cursor cursor = dbHelper.used();
        cursor.moveToNext();
        if(cursor.getInt(cursor.getColumnIndex("use"))==1)
        {
            return true;
        }
        return false;
    }
}

public class NumHelp extends AppCompatActivity
        implements View.OnClickListener {

    ImageView golastback;
    ImageView golast;
    FrameLayout last;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_num_help);

        golastback = findViewById(R.id.imgtolastback3);
        golastback.setOnClickListener(this);
        golast =findViewById(R.id.imgtolast3);
        golast.setOnClickListener(this);
        last = findViewById(R.id.frametolast3);
        last.setOnClickListener(this);
    }

    @Override
    public void onClick(View v) {
        if(v == golastback || v == golast || v == last)
        {
            finish();
        }
    }
}

public class Statehelp extends AppCompatActivity
        implements View.OnClickListener {

    ImageView golastback;
    ImageView golast;
    FrameLayout last;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_statehelp);

        golastback = findViewById(R.id.imgtolastback2);
        golastback.setOnClickListener(this);
        golast =findViewById(R.id.imgtolast2);
        golast.setOnClickListener(this);
        last = findViewById(R.id.frametolast2);
        last.setOnClickListener(this);
    }

    @Override
    public void onClick(View v) {
        if(v == golastback || v == golast || v == last)
        {
            finish();
        }
    }
}
