// ==========================================
// Motion Trainer - Headphone Strap Enclosure
// ==========================================
// Mounts to headphone headband, holds:
// - ESP32 Dev Board (TYPE-C CH340C)
// - MPU6050 (GY-521)
// - 433MHz TX module
// 
// Power via external USB cable to powerbank
// ==========================================

// === PARAMETERS - ADJUST TO FIT YOUR HEADPHONES ===

// Headphone headband dimensions (measure yours!)
headband_width = 30;      // Width of headband (mm)
headband_thickness = 4;   // Thickness of headband (mm)
headband_curve = 150;     // Approximate curve radius (mm), 0 for flat

// Clip grip
clip_grip = 2;            // How much clip overlaps headband (mm)
clip_clearance = 0.5;     // Extra space for fit (mm)

// Wall thickness
wall = 2;

// === COMPONENT DIMENSIONS ===

// ESP32 Dev Board (TYPE-C CH340C) - MEASURE YOURS!
esp_w = 28;               // Width (mm)
esp_l = 52;               // Length (mm)  
esp_h = 12;               // Height with pins (mm)

// MPU6050 GY-521
mpu_w = 16;
mpu_l = 21;
mpu_h = 4;

// 433MHz TX (FS1000A)
tx_w = 19;
tx_l = 19;
tx_h = 6;

// === CALCULATED DIMENSIONS ===

// Internal cavity
cavity_w = esp_w + 2;
cavity_l = esp_l + mpu_l + tx_l + 8;  // All in a row with gaps
cavity_h = max(esp_h, max(mpu_h, tx_h)) + 2;

// Outer dimensions
outer_w = cavity_w + wall * 2;
outer_l = cavity_l + wall * 2;
outer_h = cavity_h + wall;

// Clip dimensions  
clip_h = headband_thickness + clip_clearance * 2;
clip_total_h = clip_h + wall * 2;

// === MODULES ===

module rounded_box(w, l, h, r=2) {
    hull() {
        for (x = [r, w-r]) {
            for (y = [r, l-r]) {
                translate([x, y, 0])
                    cylinder(h=h, r=r, $fn=20);
            }
        }
    }
}

module component_slot(w, l, h, label="") {
    difference() {
        cube([w + 1, l + 1, h + 0.1]);
        // Corner relief for easier insertion
        translate([-0.5, -0.5, 0])
            cube([1, 1, h + 0.1]);
        translate([w + 0.5, -0.5, 0])
            cube([1, 1, h + 0.1]);
    }
}

module base() {
    difference() {
        union() {
            // Main body
            rounded_box(outer_w, outer_l, outer_h);
            
            // Headband clip - wraps around headband
            translate([0, outer_l/2 - headband_width/2 - wall, -clip_total_h])
                difference() {
                    // Outer clip shell
                    rounded_box(outer_w, headband_width + wall*2, clip_total_h + wall, r=2);
                    
                    // Headband channel
                    translate([wall - clip_grip, wall, wall])
                        cube([outer_w - wall*2 + clip_grip*2, 
                              headband_width, 
                              headband_thickness + clip_clearance*2]);
                    
                    // Entry slot (open on one side for sliding onto headband)
                    translate([outer_w/2 - headband_width/2, -1, wall])
                        cube([headband_width, wall + 2, clip_h]);
                }
        }
        
        // Main cavity
        translate([wall, wall, wall])
            cube([cavity_w, cavity_l, cavity_h + 1]);
        
        // USB port opening (side)
        translate([-1, wall + 5, wall + 2])
            cube([wall + 2, 12, 8]);
        
        // Antenna wire exit (top/side)
        translate([outer_w - wall - 1, wall + cavity_l - 10, wall + cavity_h - 3])
            cube([wall + 2, 6, 5]);
        
        // Ventilation holes
        for (i = [0:3]) {
            translate([outer_w/2, wall + 15 + i*15, -1])
                cylinder(d=3, h=wall+2, $fn=12);
        }
    }
    
    // Component dividers/holders inside
    translate([wall, wall, wall]) {
        // ESP32 board area
        // Corner posts to hold board
        post_h = 2;
        for (x = [2, cavity_w - 4]) {
            for (y = [2, esp_l - 2]) {
                translate([x, y, 0])
                    cylinder(d=3, h=post_h, $fn=12);
            }
        }
        
        // Divider after ESP32
        translate([0, esp_l + 2, 0])
            cube([cavity_w, 1.5, cavity_h * 0.6]);
        
        // MPU6050 area - centered, with posts
        mpu_offset_y = esp_l + 4;
        mpu_offset_x = (cavity_w - mpu_w) / 2;
        for (x = [mpu_offset_x + 2, mpu_offset_x + mpu_w - 4]) {
            for (y = [mpu_offset_y + 2, mpu_offset_y + mpu_l - 2]) {
                translate([x, y, 0])
                    cylinder(d=2.5, h=1.5, $fn=12);
            }
        }
        
        // Divider after MPU
        translate([0, esp_l + mpu_l + 6, 0])
            cube([cavity_w, 1.5, cavity_h * 0.6]);
        
        // TX module area - remaining space
    }
}

module lid() {
    difference() {
        union() {
            // Main lid
            rounded_box(outer_w, outer_l, wall);
            
            // Inner lip to hold lid in place
            translate([wall + 0.5, wall + 0.5, wall])
                difference() {
                    cube([cavity_w - 1, cavity_l - 1, 2]);
                    translate([1.5, 1.5, -0.1])
                        cube([cavity_w - 4, cavity_l - 4, 2.2]);
                }
        }
        
        // Status LED window (for ESP32 built-in LED)
        translate([outer_w/2, wall + esp_l/2, -0.1])
            cylinder(d=4, h=wall + 0.2, $fn=16);
        
        // Label engraving
        translate([outer_w/2, outer_l/2, wall - 0.5])
            linear_extrude(0.6)
                text("MT", size=8, halign="center", valign="center");
    }
}

// === RENDER ===

// Uncomment the part you want to export:

// Main enclosure base
base();

// Lid (positioned for printing)
// translate([outer_w + 10, 0, 0]) lid();

// Both parts for preview
 translate([0, 0, outer_h + 5]) lid();

// === PRINT SETTINGS ===
// Layer height: 0.2mm
// Infill: 15-20%
// Supports: Yes, for the clip overhang
// Material: PLA or PETG