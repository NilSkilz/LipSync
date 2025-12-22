// All dimensions in mm

// === MAIN PARAMETERS ===
box_width = 32;      // X dimension
box_length = 58;     // Y dimension  
box_height = 20;     // Z dimension

wall_width = 1;

usb_width = 10;
usb_height = 5;

strap_width = 5;
strap_height = 1;

mcu_length = 21.11;
mcu_width = 15.75;
mcu_hole_diameter = 3.12;

$fn = 360;

module usb_hole() {
    cube([usb_width,10,usb_height]);
}

module strap_hole() {
    cube([strap_width,strap_width,strap_height]);
}

module enclosure() {
    difference() {
        cube([box_width, box_length, box_height]);
        translate([wall_width, wall_width, wall_width,]) {
            cube([box_width-(wall_width*2), box_length-(wall_width*2), box_height-(wall_width/2)]);
        }
        
        // USB Hole
        translate([(box_width/2)-(usb_width/2),-5,wall_width]) {
            usb_hole();
        }
        
        // Strap Holes
        translate([-2, 10, wall_width]) {
            strap_hole();
        }

        translate([-2, 43, wall_width]) {
            strap_hole();
        }

        translate([29, 10, wall_width]) {
            strap_hole();
        }

        translate([29, 43, wall_width]) {
            strap_hole();
        }
    }
   
}

module MCU() {
    difference() {
        cube([mcu_length, 1, mcu_width]);
        rotate([90, 0, 0]) {
            translate([4.335,mcu_width-4.335,-2]) {
                cylinder(r=mcu_hole_diameter/2, h=2);
            }
        }
        rotate([90, 0, 0]) {
            translate([mcu_length-4.335,mcu_width-4.335,-2]) {
                cylinder(r=mcu_hole_diameter/2, h=2);
            }
        }
    }
}



enclosure();
translate([box_width/2-(mcu_length/2),2,8]) {
    // MCU();
}

module pins() {
     translate([9.8,4,(8+mcu_width)-4.335]) {
        rotate([90,0,0]) {
            cylinder(r=1.4, h=3);
        }
    }
    translate([22.2,4,(8+mcu_width)-4.335]) {
        rotate([90,0,0]) {
            cylinder(r=1.4, h=3);
        }
    }
}

