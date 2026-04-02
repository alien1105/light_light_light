//------------------------------------------------------------------------------
// Pre_view 是一個HTML元件，可直接在html中使用，用於模擬 LED 圓環燈效的前端預覽
// 直接寫 <pre-view pre-view-data = "data.json" ></pre-view> 這樣就可以用了
// 
//------------------------------------------------------------------------------
//
// HTNL屬性（Attributes）
//
// 屬性名稱	                說明	                           預設值
// width	               畫布寬度（px）	                   500
// height	               畫布高度（px）	                   500
// pre-view-data	       編招JSON 路徑	                   必填
// led-bulb-size	       單顆 LED 顯示大小（px）	            2
// led-bulb-spacing    	   LED 之間的間距（px）	                3
// inner-radius	           圓環內徑半徑（px）               	80
// anime	               是否啟用動畫效果 (true / false)   	false
// speed	               動畫播放速度（數值越大越快）	         60
//
//
//------------------------------------------------------------------------------

const ESP_LEDSHOW_DELAY = 1; //ms
const SHOW_ANGLE = 100; //degree

import bitmaps from './bitmaps.json' with { type: 'json' };


class Pre_view extends HTMLElement {

    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });    
    }

    
    
    async connectedCallback() { //當元件被加入到 DOM 時觸發
        
        const width             = Number(this.getAttribute('width'))  || 500;
        const height            = Number(this.getAttribute('height')) || 500;
        const data_path         = this.getAttribute("pre-view-data");
        this.led_bulb_size      = Number(this.getAttribute('led-bulb-size')) || 2;
        this.inner_radius       = Number(this.getAttribute('inner-radius')) || 80;
        this.led_bulb_spacing   = Number(this.getAttribute('led-bulb-spacing')) || 3;
        this.anime              = (this.getAttribute('anime') || "false") == "true";
        this.speed              = Number(this.getAttribute('speed')) || 60;  // rad/s
        this.mode_idx           = Number(this.getAttribute('mode-idx')) || 0;
        this.set_start_time     = Number(this.getAttribute('set-start-time')) || 0;
        
        console.log(`set_start_time: ${this.set_start_time}`);
        this.angular_speed      = 0.9; // degree/ms
        this.pre_color_count    = 0;
        this.pre_color_count_id = 0;
        // 建立 canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;

         // 將 canvas 加入 shadow DOM
        this.shadowRoot.appendChild(this.canvas);


        //  讀取json檔

        /*this.mode_json_data = await this.loadJSON(data_path);     
    

        for(let i=0; i<this.set_start_time; i++){
            console.log(`mode: ${this.mode_json_data[this.pre_color_count_id]}, pre_color_count_id: ${this.pre_color_count_id}`);
            this.pre_color_count++;
            this.checkDuration(this.mode_json_data[this.pre_color_count_id]);
            this.pre_color_count_id = 0;
        }*/

    //-----------------------------------------------------------
    //  建立畫布
    //-----------------------------------------------------------

        // 建立 canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;

        // 將 canvas 加入 shadow DOM
        this.shadowRoot.appendChild(this.canvas);        
       
    //-----------------------------------------------------------
    //  繪製背景
    //-----------------------------------------------------------
        //增加 willReadFrequently 選項以提升讀取效能
        this.ctx = this.canvas.getContext('2d', {willReadFrequently: true}); 
        let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        //繪製黑色底色
        for (let i = 0; i < this.canvas.width; i++) {
            for (let j = 0; j < this.canvas.height; j++) {
                const idx = (j * this.canvas.width + i) * 4;
                imageData.data[idx] = 0;
                imageData.data[idx + 1] = 0;
                imageData.data[idx + 2] = 0;
                imageData.data[idx + 3] = 255; 
            }   
        }        
        //繪製灰色網格
        for (let i = 0; i < this.canvas.width; i+=20) {
            for (let j = 0; j < this.canvas.height; j++) {
                const idx = (j * this.canvas.width + i) * 4;
                imageData.data[idx] = 27;
                imageData.data[idx + 1] = 27;
                imageData.data[idx + 2] = 27;
                imageData.data[idx + 3] = 255; 
            }   
        }         
        for (let i = 0; i < this.canvas.width; i++) {
            for (let j = 0; j < this.canvas.height; j+=20) {
                const idx = (j * this.canvas.width + i) * 4;
                imageData.data[idx] = 27;
                imageData.data[idx + 1] = 27;
                imageData.data[idx + 2] = 27;
                imageData.data[idx + 3] = 255; 
            }   
        } 
        //建立二維陣列存放 LED 資料 this.led_show_arr[60][32][3]
        this.led_show_arr = new Array(100000);
        for (let i = 0; i < 100000; i++) {
            this.led_show_arr[i] = new Array(32);
            for (let j = 0; j < 32; j++) {
                this.led_show_arr[i][j] = new Array(4).fill(0); 
            }
        }

 

    //-----------------------------------------------------------
    //  計算LED顏色
    //-----------------------------------------------------------
          
        for (let i = 0; i < 10000; i++) {
                //計算顏色
                //計算形狀
        }
        

        this.start_time = performance.now();
        this.ctx.putImageData(imageData, 0, 0);
        this.update(0);
    }

    // [pre_view.js] 新增這兩個函式到 class 內
    // 接收即時資料並重新計算
    updateData(modeData) {
    if (!modeData) return;
    
    // 1. 清空舊數據
    this.pre_color_count = 0; 
    this.pre_color_count_id = 0;
    this.mode_json_data = [modeData]; // 將單一效果包裝成陣列

    // 2. 執行計算 (這會填充 led_show_arr)
    this.perform(); 

    // 3. 確保動畫迴圈啟動
    if (!this.animationFrameId) {
        this.update(0);
    }
}



    //讀取 json & 繪製，並將長方形內容偏移到圓形上，更新頻率約為60fps(以瀏覽器為準)
    async drawSomething(timer) {
        const speed = this.speed;
        const led_show_arr = this.led_show_arr; // 使用 class 內部的資料庫
        if (!led_show_arr || !led_show_arr[0]) return; // 安全檢查

        let show_time = Math.floor(10000/speed);

        timer++;
        if(Math.floor(timer)%60==0) console.log(Math.floor(timer)/60);

    
        //開始渲染啦!!
        
        this.ctx = this.canvas.getContext('2d', {willReadFrequently: true}); //增加 willReadFrequently 選項以提升讀取效能
        let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        


        //將長方形內的內容偏移到圓形上
        for (let i = 0; i < ((this.anime)?timer*speed/20 +30:show_time); i++) {
            for (let j = 0; j < 32; j++) {     
                //顏色
                let r, g, b;
                r = led_show_arr[i][j][0];
                g = led_show_arr[i][j][1];
                b = led_show_arr[i][j][2]; 
                //位置
                const cx = this.canvas.width>>1; // 圓心 X
                const cy = this.canvas.height>>1; // 圓心 Y
                const inner_radius = this.inner_radius;
                const outer_radius = inner_radius + 140;
                //console.log(`${inner_radius}`);
                let col_x = cx + (Math.round( ( (outer_radius-j*this.led_bulb_spacing) ) * Math.sin( ((i*(-1)+show_time/2)/show_time)*2*Math.PI ) ) );
                let col_y = cy + (Math.round( ( (outer_radius-j*this.led_bulb_spacing) ) * Math.cos( ((i*(-1)+show_time/2)/show_time)*2*Math.PI ) ) );
                
                //繪製小方塊
                if(((this.anime)?(i < timer*speed/20-30):(false))){
                    for(let w=0; w<this.led_bulb_size; w++){
                        for(let h=0; h<this.led_bulb_size; h++){
                            const idx = ((col_y+w) * this.canvas.width + col_x+h) * 4;
                            imageData.data[idx] = 0;
                            imageData.data[idx + 1] = 0;
                            imageData.data[idx + 2] = 0;
                            imageData.data[idx + 3] = 256; 
                        }
                    }
                }else{
                    for(let w=0; w<this.led_bulb_size; w++){
                        for(let h=0; h<this.led_bulb_size; h++){
                            const darken = ((this.anime)?((timer*speed/20+15-i)*3):0)
                            const idx = ((col_y+w) * this.canvas.width + col_x+h) * 4;
                            imageData.data[idx] = r-darken;
                            imageData.data[idx + 1] = g-darken;
                            imageData.data[idx + 2] = b-darken;
                            imageData.data[idx + 3] = 256; 
                        }
                    }
                }
            }
        }
 

        this.ctx.putImageData(imageData, 0, 0);
    }
    
    getCurrentModeName(currentTime) {
        if (!this.mode_json_data) return "UNKNOWN";

        // 尋找符合條件的 mode：start_time <= currentTime < (start_time + duration)
        const currentMode = this.mode_json_data.find(m => {
            return currentTime >= m.start_time && currentTime < (m.start_time + m.duration);
        });

        return currentMode ? currentMode.mode : "IDLE";
    }

    update(timer) {
        this.drawSomething(timer); 
        requestAnimationFrame(() => this.update((timer+1)));
    }

    perform(){   
        //if (!this.mode_json_data) return;     
        //console.log(`mode_json_data.length: ${this.mode_json_data.length}, pre_color_count_id: ${this.pre_color_count_id}`);
        let start_pre_color_count = this.pre_color_count;
        while(this.pre_color_count - start_pre_color_count < 2000){  
            if(this.pre_color_count_id >= this.mode_json_data.length){
                this.pre_color_count++;
                continue;
            }
            let m = this.mode_json_data[this.pre_color_count_id];      
            switch(m.mode){
                case "MODES_CLEAR":      this.clear          (m);  break;
                case "MODES_PLAIN":      this.plain          (m);  break;
                case "MODES_SQUARE":     this.square         (m);  break;
                case "MODES_SICKLE":     this.sickle         (m);  break;
                case "MODES_FAN":        this.fan            (m);  break;
                case "MODES_BOXES":      this.boxes          (m);  break;
                case "MODES_MAP_ES":     this.bitmapEs       (m);  break;
                case "MODES_MAP_ES_ZH":  this.bitmapEsZh     (m);  break;
                case "MODES_CMAP_DNA":   this.colormapDna    (m);  break;
                case "MODES_CMAP_FIRE":  this.colormapFire   (m);  break;
                case "MODES_CMAP_BENSON":this.colormapBenson (m);  break;
                case "MODES_CMAP_YEN":   this.colormapYen    (m);  break;
                case "MODES_CMAP_LOVE":  this.colormapLove   (m);  break;
                case "MODES_CMAP_GEAR":  this.colormapGear   (m);  break;
                case "MODES_MAP_ESXOPT": this.bitmapESXOPT   (m);  break;
                default: console.log("we don't have this mode."); break;
            }
        }
    }

    
    /************************************
     *        Effect Helper
     ************************************/
    /* Block until pass through start position */
    blockUntilStart( start,  timeout){
        this.start_time = performance.now();
        // while( detector.read_flag() != Rotation_SET && (millis()-start_time < timeout)) 
        //     ;
        // detector.clear_flag();
    }

    detectPassStart( start){
        // if ( detector.read_flag() ){
        //     detector.clear_flag();
        //     return true;
        // }
        return false;
    }

    /* It should be called to initialize the color scheduler */
    setEffectStart(m){
        this.time_idx = 0;
        effect_entry_time = performance.now();
        this.effect_entry_time = effect_entry_time;
        //sch.SetXHsvParam(m->XH, m->XS, m->XV);
        //sch.SetYHsvParam(m->YH, m->YS, m->YV);
    }

    setEffectBlockStart(){
        this.effect_start_idx = this.time_idx;
    }

    /* Get the X direction index while effect performing */
    getIdx(){
        this.time_idx++;
        return this.time_idx;
    }

    /* Check whether to stop */
    checkDuration(m){
        //Serial.println(getMusicTime());
        if(this.pre_color_count < m.start_time + m.duration){
            return true;
        }else{
           // console.log(`pre_color_count: ${this.pre_color_count}, pre_color_count_id: ${this.pre_color_count_id}`);
            this.pre_color_count_id++;
          //  console.log(`pre_color_count: ${this.pre_color_count}, pre_color_count_id: ${this.pre_color_count_id}`);
            return false;
        }
    }

    showLED(){
        FastLED.show();
    }




    async loadJSON(data_path) {
        try {
            const response = await fetch(data_path);
            if (!response.ok) throw new Error('讀取錯誤');
            const jsonData = await response.json();

            return jsonData[0];
            
        } catch (err) {
            console.error(err);
        }
    }

    LIMIT_OUTPUT(x) {
        if (x > 0xff) return 0xff; 
        if (x < 0) return 0;
        return x;
    }


    /************************************
     *       Scheduler Functions
     ************************************/
    /* Create ramp-like function 
    *   /     /     upper
    *  /     /
    * +     +       lower
    * |range|
    */ 
    calc_ramp(idx, range, lower, upper, overflow){
        const mod = idx % range;
        const output = lower + (Math.floor(Math.floor(mod))* (upper - lower) / range);
        return (!overflow)?this.LIMIT_OUTPUT(output):output;
    }

        
    /* Create triangular-like function 
    *   / \   /    upper
    *  /   \ /
    * +     +      lower
    * |range|
    */ 
    calc_tri(idx, range, lower, upper, overflow){
        const delta = upper - lower;
        const half = range / 2;
        const mod = idx % range;
        const output = lower + Math.floor(Math.abs(Math.floor(mod) - half) * delta / half);
        return (!overflow)?this.LIMIT_OUTPUT(output):output;
        //return (!overflow && output > 0xff) ? 255 : output;
    }

        
    /* Create pulse-like function 
    *  |\        upper
    *  | \  
    *  |   --    lower
    * @Param:
    *      top: length of peak time
    * # TODO: the `lower` parameter is useless now
    */ 
    calc_pulse(idx, range, lower, top){
        const mod = idx - Math.floor((idx/range) * range);
        if (mod < top) return 0xff;
        const decay = Math.floor((idx - top) * 8 / range);
        return 0xff >> decay;
    }

        
    /* Create step-like function 
    *         -----  lower+step*2
    *        |     |
    *   -----      | lower+step
    *  |           |
    * +     +     +  lower
    * |range|range|
    * num = 2
    */ 
    calc_step(idx, range, lower, step, num, overflow){
        const state = Math.floor((Math.floor(idx) % (range * num)) / range);
        const output = lower + step * state;
        return output;
        //return (!overflow && output > 0xff) ? 255 : output;
    }
/*
    SetXHsvParam(H, S, V){
        XHp = H; XSp = S; XVp = V;
    }

    SetYHsvParam(H, S, V){
        YHp = H; YSp = S; YVp = V;
    }
*/
    /* Return function value according to the parameter
    * See also @SchedulerFunc in core.h             */
    getFuncValue(vp, idx, overflow){
        //console.log(`func: ${vp.p1}`);
        switch (vp.func){
            case 1:
                return vp.p1;
            case 2:
                return this.calc_ramp(idx, vp.range, vp.lower, vp.p1, true);
            case 3:
                return this.calc_tri(idx, vp.range, vp.lower, vp.p1, true);
            case 4:
                return this.calc_pulse(idx, vp.range, vp.lower, vp.p1);
            case 5:
                return this.calc_step(idx, vp.range, vp.lower, vp.p1, vp.p2, true);
            default:
                return 0;
        }
    }

    updateHeading(mode_json_data, idx, restart){
        let delta = 0;
        
        if (restart)    delta = idx - mode_json_data.start_time;
        else            delta = idx - 0;
        
        delta = idx;
       // console.log(`idx: ${mode_json_data.XH.range}`);

        let h, s, v;
        h = this.getFuncValue(mode_json_data.XH, delta);
        s = this.getFuncValue(mode_json_data.XS, delta);
        v = this.getFuncValue(mode_json_data.XV, delta);
        for(let j=0; j<32; j++){    
            let yh, ys, yv;
            yh = h + this.getFuncValue(mode_json_data.YH, j);
            ys = s + this.getFuncValue(mode_json_data.YS, j);
            yv = v + this.getFuncValue(mode_json_data.YV, j);
            let rgb_value = this.hsvToRgb(yh, ys, yv);
           // console.log(`h: ${yh}, s: ${ys}, v: ${yv}, r: ${rgb_value.r}, g:  ${rgb_value.g}, b: ${rgb_value.b}`);
           
            this.led_show_arr[this.pre_color_count][j][0] = rgb_value.r;
            this.led_show_arr[this.pre_color_count][j][1] = rgb_value.g;
            this.led_show_arr[this.pre_color_count][j][2] = rgb_value.b;    
        } 
         
    }

    hsvToRgb(h, s, v) {
        // 將 H, S, V 歸一化到標準範圍：
        // H: 0-360度; S, V: 0-1
        let h_norm = h / 255 * 360; // 將 0-255 轉換為 0-360
        let s_norm = s / 255;       // 將 0-255 轉換為 0-1
        let v_norm = v / 255;       // 將 0-255 轉換為 0-1

        let r, g, b;

        if (s_norm === 0) {
            // 如果飽和度為 0，則顏色為灰色 (R=G=B=V)
            r = g = b = v_norm;
        } else {
            let i = Math.floor(h_norm / 60);
            let f = h_norm / 60 - i;
            
            let p = v_norm * (1 - s_norm);
            let q = v_norm * (1 - f * s_norm);
            let t = v_norm * (1 - (1 - f) * s_norm);

            switch (i % 6) {
                case 0: r = v_norm; g = t; b = p; break; // R -> Y
                case 1: r = q; g = v_norm; b = p; break; // Y -> G
                case 2: r = p; g = v_norm; b = t; break; // G -> C
                case 3: r = p; g = q; b = v_norm; break; // C -> B
                case 4: r = t; g = p; b = v_norm; break; // B -> M
                case 5: r = v_norm; g = p; b = q; break; // M -> R
            }
        }

        // 將 R, G, B 從 0-1 範圍轉換回 0-255 範圍 (並確保為整數)
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    /*
    updateHeading(idx, restart, this.led_show_arr){
        delta=0;
        
        //if (restart)    delta = idx - effect_start_idx;
        //else            delta = idx - 0;
        
        delta = idx;
        headingColor.h = getFuncValue(XHp, delta);
        headingColor.s = getFuncValue(XSp, delta);
        headingColor.v = getFuncValue(XVp, delta);
    }

*/
/*
    CRGB inline ColorScheduler::getPixelColor(uint8_t y){
        return CHSV(headingColor.h + getFuncValue(&YHp, y),
                    headingColor.s + getFuncValue(&YSp, y),
                    headingColor.v + getFuncValue(&YVp, y));
    }
*/

/*
    perform(mode_json_data){
        
    if (force_start == 2){
      effect_id = 0;
      buffer.clean();
    }
    if (buffer.isEmpty()) {
      clear();
      lightOnOneLED(CHSV(130, 200 ,55));
      return;
    }
    Mode m;
    buffer.peek(m);
    if (m.start_time < getMusicTime() || force_start == 1){
        // Load new mode
        buffer.pop(&m);
        Serial.print("Now Performing: ");
        Serial.println(m.mode);
        switch(mode_json_data.mode){
            case "MODES_CLEAR":      this.clear          (mode_json_data, this.led_show_arr);  break;
            case "MODES_PLAIN":      this.plain          (mode_json_data, this.led_show_arr);  break;
            case "MODES_SQUARE":     this.square         (mode_json_data, this.led_show_arr);  break;
            case "MODES_SICKLE":     this.sickle         (mode_json_data, this.led_show_arr);  break;
            case "MODES_FAN":        this.fan            (mode_json_data, this.led_show_arr);  break;
            case "MODES_BOXES":      this.boxes          (mode_json_data, this.led_show_arr);  break;
            case "MODES_MAP_ES":     this.bitmapEs       (mode_json_data, this.led_show_arr);  break;
            case "MODES_MAP_ES_ZH":  this.bitmapEsZh     (mode_json_data, this.led_show_arr);  break;
            case "MODES_CMAP_DNA":   this.colormapDna    (mode_json_data, this.led_show_arr);  break;
            case "MODES_CMAP_FIRE":  this.colormapFire   (mode_json_data, this.led_show_arr);  break;
            case "MODES_CMAP_BENSON":this.colormapBenson (mode_json_data, this.led_show_arr);  break;
            case "MODES_CMAP_YEN":   this.colormapYen    (mode_json_data, this.led_show_arr);  break;
            case "MODES_CMAP_LOVE":  this.colormapLove   (mode_json_data, this.led_show_arr);  break;
            case "MODES_CMAP_GEAR":  this.colormapGear   (mode_json_data, this.led_show_arr);  break;
            case "MODES_MAP_ESXOPT": this.bitmapESXOPT   (mode_json_data, this.led_show_arr);  break;
            default: console.log("we don't have this mode."); break;
        }
    }
 
*/
    /************************************
     *              Effects
     ************************************/
   
    clear(m){     
        for(let j=0; j<32; j++){
            this.led_show_arr[this.pre_color_count][j][0] = 0;
            this.led_show_arr[this.pre_color_count][j][1] = 0;
            this.led_show_arr[this.pre_color_count][j][2] = 0;
        }
        this.pre_color_count++;
        this.checkDuration(m);
    }
    plain(m){
        this.updateHeading(m, this.pre_color_count, false);
        this.pre_color_count++;
        this.checkDuration(m);
    }

    square(m){
        
        const boxsize = m.p3;

        while( this.checkDuration(m) ){
            let l = 0;
            for (let b=1; b<boxsize; b++){
                let map = 0;

                let unit = (1<<b) - 1;
                //if(b>=32) unit = -1;

                for (let k=0; k<boxsize/b; k++)
                    map |= unit << (2*k);
                
                for (let j=0; j<boxsize/b; j+=2){
                    this.updateHeading(m, l, 0);
                    for(let s=0; s<32; s++){
                        if(!(map & 1)){
                            this.led_show_arr[this.pre_color_count][s][0] = 0;
                            this.led_show_arr[this.pre_color_count][s][1] = 0;
                            this.led_show_arr[this.pre_color_count][s][2] = 0;
                        }
                        map >>= 1;
                    }
                    l++
                    this.pre_color_count++;
                    map ^= map;
                }
            }
        }
    }

    /*
    square(m){
        const boxsize = m.p3;

        let t = this.pre_color_count - m.start_time;

        // count current b
        let b = 1, l;
        let light = false;
        let cycle_t = 0
        for (b = 1; b<boxsize; b++){
            for (let j=0; j<boxsize/b; j+=2){  
               cycle_t++;
            }
        }
         
        t = t%cycle_t;


        for(let i=0; i<t;){
            l = 0;
            b = 1;
            for (;i<t && b<boxsize; b++){
                for (let j=0;j<boxsize/b; j+=2){  
                    i++;
                    if(i>=t){
                        if(j==0) light = true;
                        break;
                    }
                    l++;
                }
            }
        }

            
        if(light){
            this.updateHeading(m, l, 0);
            let map = 0;
            let unit = ((1<<b) - 1);
            for (let k=0; k<boxsize/b; k++) map |= unit << (2*k);
            for(let j=0; j<32; j++){
                if(!(map & 1)){
                    this.led_show_arr[this.pre_color_count][j][0] = 0;
                    this.led_show_arr[this.pre_color_count][j][1] = 0;
                    this.led_show_arr[this.pre_color_count][j][2] = 0;
                }
                map >>= 1;
            }
           
        }else{
            for(let j=0; j<32; j++){
                this.led_show_arr[this.pre_color_count][j][0] = 0;
                this.led_show_arr[this.pre_color_count][j][1] = 0;
                this.led_show_arr[this.pre_color_count][j][2] = 0;
            }
        }     


        this.pre_color_count++;
        this.checkDuration(m)
    }
    */

    boxes(m){
        
        const boxsize = m.p3;
        const space = m.p4;
        while( this.checkDuration(m) ){
            let l = 0;
            for (let b=1; b<boxsize; b++){
                let map = 0;

                let unit = ((1<<b) - 1) << ((32 - b)/2);
                for (let j=0; j<boxsize/2; j++){
                    this.updateHeading(m, l, 0);
                    for(let s=0; s<32; s++){
                        if(!(unit & 1)){
                            this.led_show_arr[this.pre_color_count][s][0] = 0;
                            this.led_show_arr[this.pre_color_count][s][1] = 0;
                            this.led_show_arr[this.pre_color_count][s][2] = 0;
                        }
                        unit >>= 1;
                    }
                    l++
                    this.pre_color_count++;
                }
                for (let j=0; j<space; j++){
                    for(let s=0; s<32; s++){
                        this.led_show_arr[this.pre_color_count][s][0] = 0;
                        this.led_show_arr[this.pre_color_count][s][1] = 0;
                        this.led_show_arr[this.pre_color_count][s][2] = 0;                        
                    }
                    l++
                    this.pre_color_count++;
                }
            }
        }
    }

    /*
    boxes(m){
        //Serial.println("Boxes");
        const boxsize = m.p3;
        const space = m.p4;

        let cycle_t = boxsize/2+space;
        let t = (this.pre_color_count - m.start_time) % (cycle_t);
        let b = t;

        if(b < boxsize/2){

        }else{

        }


        //setEffectStart(m);
        for (let idx = 0; idx<m.duration;idx++){
            for (let b=1; b<boxsize; b++){
                let map = 0;

                let unit = ((1<<b) - 1) << ((32 - b)/2);
                for (let j=0; j<boxsize/2; j++,idx++){                    
                    for(let jdx=0,chuse_bit=1; jdx<32; jdx++){
                        if(!(map & chuse_bit)){
                            this.led_show_arr[idx][jdx][0] = 0;
                            this.led_show_arr[idx][jdx][1] = 0;
                            this.led_show_arr[idx][jdx][2] = 0;
                        }
                        chuse_bit <<= 1;
                    }
                }
                for (let j=0; j<space; j++){
                    
                }
            }
        }
        while( checkDuration(m) ){
            setEffectBlockStart();
            for (int b=1; b<boxsize; b++){
                uint32_t map = 0;

                uint32_t unit = (((uint32_t)0x1<<b) - 1) << ((NUMPIXELS - b)/2);
                for (int j=0; j<boxsize/2; j++){
                    uint16_t idx = getIdx();
                    sch.updateHeading(idx);
                    sch.getPixelColor(pixels, unit, CHSV(0, 0, 0));
                    showLED();
                }
                for (int j=0; j<space; j++){
                    FastLED.clear();
                    showLED();
                }
            }
        }
    }
    */

    sickle(m){
        //Serial.println("Sickle");
        let position_fix = m.p1;
        let width = m.p3;
        let space = m.p4;
        //setEffectStart(m);
        while( this.checkDuration(m) ){
            let l = 0;        
            let pixels = new Array(32);
            for (let b=1; b<width; b++){   
                for (let lt=(32 * (b-1) / width); lt < 32 * b / width; lt++)
                    pixels[lt] = 1;
                this.updateHeading(m, l , 0);
                for(let s=0; s<32; s++){
                    if(!pixels[s]){
                        this.led_show_arr[this.pre_color_count][s][0] = 0;
                        this.led_show_arr[this.pre_color_count][s][1] = 0;
                        this.led_show_arr[this.pre_color_count][s][2] = 0;        
                    }                
                }
                l++
                this.pre_color_count++;
            }
            console.log(`${pixels}`);
            for (let j=0; j<space; j++){
                for(let s=0; s<32; s++){
                    this.led_show_arr[this.pre_color_count][s][0] = 0;
                    this.led_show_arr[this.pre_color_count][s][1] = 0;
                    this.led_show_arr[this.pre_color_count][s][2] = 0;                        
                }
                l++
                this.pre_color_count++;
            }
        }
    }

    fan(m){
        //Serial.println("Sickle");
        const width = m.p1;
        const density = m.p3;
        const thickness = m.p4;
        while( this.checkDuration(m) ){
            for (let w=0; w<width; w++){
                let l = 0;
                this.updateHeading(m, l , 0);
                          
                let pixels = new Array(32);      
                let led_idx = (32 * w / width) % density;
                for (let d=0; d<=32/density; d++){
                    for (let t=0; t<thickness; t++){
                        let lidx = led_idx + d * density + t;
                        if (lidx < 32)
                        pixels[lidx] = 1;
                    }
                }
                for(let s=0; s<32; s++){
                    if(!pixels[s]){
                        this.led_show_arr[this.pre_color_count][s][0] = 0;
                        this.led_show_arr[this.pre_color_count][s][1] = 0;
                        this.led_show_arr[this.pre_color_count][s][2] = 0;        
                    }                
                }
                l++
                this.pre_color_count++;
            }
        }
    }

    // p1: reverse
    //p4: space
  
    bitmap(m, map, length){
        const reverse = m.p1;
        const space = m.p4;
        //setEffectStart(m);
        //while( checkDuration(m) ){
        // console.log(`m.p1 = ${m.duration}`);
        //console.log(`this.pre_color_count = ${map}`);
        
        const l = (this.pre_color_count- m.start_time)%(length+space);

        this.updateHeading(m, l, 0);

        if(l<length){
            let chuse_bit = 1;
            for(let j=0; j<32; j++){
                if (reverse){
                    if(map[l] & chuse_bit){
                        this.led_show_arr[this.pre_color_count][j][0] = 0;
                        this.led_show_arr[this.pre_color_count][j][1] = 0;
                        this.led_show_arr[this.pre_color_count][j][2] = 0;
                    }
                }
                else{
                    //console.log(`m.p1 = ${map[i]}`);
                    if((~map[l]) & chuse_bit){
                        this.led_show_arr[this.pre_color_count][j][0] = 0;
                        this.led_show_arr[this.pre_color_count][j][1] = 0;
                        this.led_show_arr[this.pre_color_count][j][2] = 0;
                    }
                }     
                chuse_bit <<= 1;                 
            }
        }else{
            for(let j=0; j<32; j++){
                this.led_show_arr[this.pre_color_count][j][0] = 0;
                this.led_show_arr[this.pre_color_count][j][1] = 0;
                this.led_show_arr[this.pre_color_count][j][2] = 0;
            }
        }

        this.pre_color_count++;
        this.checkDuration(m);
    }

     
    // p4: space
    
    colormap(m, colormap,  length){
        const space = m.p4;
        const l = (this.pre_color_count- m.start_time)%(length+space);
        if(l<length){
            for(let j=0; j<32; j++){
                let rgb_value = this.hsvToRgb((colormap[l][j] >> 7 & 0xf8)%255,
                                              (colormap[l][j] >> 2 & 0xf8)%255,
                                              (colormap[l][j] << 3 & 0xf8)%255,
                                             );
                this.led_show_arr[this.pre_color_count][j][0] = rgb_value.r;
                this.led_show_arr[this.pre_color_count][j][1] = rgb_value.g;
                this.led_show_arr[this.pre_color_count][j][2] = rgb_value.b;  
            }
        }else{
            for(let j=0; j<32; j++){
                this.led_show_arr[this.pre_color_count][j][0] = 0;
                this.led_show_arr[this.pre_color_count][j][1] = 0;
                this.led_show_arr[this.pre_color_count][j][2] = 0;  
            }
        }
        this.pre_color_count++;
        this.checkDuration(m);
        /*
        for (let idx = 0; idx<m.duration; ){
            for (let i=length-1; i>=0&&idx<m.duration; i--,idx++){
                 for(let j=0; j<32; j++){
                   //console.log(`${(colormap[idx][6] >> 2 & 0xf8)%255}`);
                    let rgb_value = this.hsvToRgb((colormap[i][j] >> 7 & 0xf8)%255,
                                                  (colormap[i][j] >> 2 & 0xf8)%255,
                                                  (colormap[i][j] << 3 & 0xf8)%255,
                                                 );
                    this.led_show_arr[idx][j][0] = rgb_value.r;
                    this.led_show_arr[idx][j][1] = rgb_value.g;
                    this.led_show_arr[idx][j][2] = rgb_value.b;  
                }
            }
            for (let i=0; i<space&&idx<m.duration; i++,idx++){
                 for(let j=0; j<32; j++){
                    this.led_show_arr[idx][j][0] = 0;
                    this.led_show_arr[idx][j][1] = 0;
                    this.led_show_arr[idx][j][2] = 0;
                 }
            }
        }*/
        //setEffectStart(m);
      /*  while( checkDuration(m) ){
            for (int i=0; i<length; i++){
                uint16_t idx = getIdx();
                sch.updateHeading(idx);
                sch.getPixelColor(pixels, map[i]);
                showLED();
                    for( uint8_t i=0; i<NUMPIXELS; i++){
        pixels[i] = CHSV(
            colormap[i] >> 7 & 0xf8,
            colormap[i] >> 2 & 0xf8,
            colormap[i] << 3 & 0xf8
        );
    }
            }
            for (int j=0; j<space; j++){
                FastLED.clear();
                showLED();
            }
        }*/
    }
    
    bitmapEs(m){
        this.bitmap(m, bitmaps.BITMAP_ES, bitmaps.BITMAP_SIZE_ES);
    }    
   
    bitmapEsZh(m){
        const reverse = m.p1;
        this.bitmap(m, bitmaps.BITMAP_ES_ZH, bitmaps.BITMAP_SIZE_ES_ZH);
    }

    colormapDna(m){
        const reverse = m.p1;
        //console.log(`reverse: ${bitmaps.BITMAP_SIZE_DNA}`);
        this.colormap(m, bitmaps.BITMAP_DNA, bitmaps.BITMAP_SIZE_DNA);
    }

    colormapFire(m){
        const reverse = m.p1;
        this.colormap(m, bitmaps.FIRE, 32);
    }

    colormapBenson(m){
        this.bitmap(m, bitmaps.BENSON, bitmaps.BITMAP_SIZE_BENSON);
    }

     colormapYen(m){
        this.bitmap(m, bitmaps.YEN, bitmaps.BITMAP_SIZE_YEN);
    }

    colormapLove(m){
        this.bitmap(m, bitmaps.LOVE, bitmaps.BITMAP_SIZE_LOVE);
    }

    colormapGear(m){
        this.colormap(m, bitmaps.GEAR, bitmaps.BITMAP_SIZE_GEAR);
    }

    bitmapESXOPT(m){
        this.bitmap(m, bitmaps.BITMAP_ESXOPT, bitmaps.BITMAP_SIZE_ESXOPT);
    }


}
customElements.define("pre-view", Pre_view);
