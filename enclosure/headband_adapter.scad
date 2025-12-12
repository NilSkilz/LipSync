// Headband Enclosure with Elliptical Arch Cutout
// All dimensions in mm

// === MAIN PARAMETERS ===
box_width = 32;      // X dimension
box_length = 58;     // Y dimension  
box_height = 10;     // Z dimension

arch_height = 9;    // How deep the arch cuts up into the box (Z)

// === ARCH SHAPE PARAMETERS ===
// These control the elliptical shape of the arch
arch_radius_x = 30;  // Half-width of arch opening (X direction)
arch_radius_y = 38;  // Curvature along length (Y direction) - larger = flatter curve

// Set this to true for a simple cylindrical arch (curves only in X, not Y)
simple_arch = false;

// === RENDER ===
$fn = 80;  // Smoothness of curves

module elliptical_arch() {
    if (simple_arch) {
        // Simple cylindrical arch - only curves in X direction
        translate([0, 0, 0])
        rotate([-90, 0, 0])
        scale([1, arch_height / arch_radius_x, 1])
        cylinder(h = box_length + 2, r = arch_radius_x, center = true);
    } else {
        // Ellipsoid arch - curves in both X and Y directions
        scale([arch_radius_x, arch_radius_y, arch_height])
        sphere(r = 1);
    }
}

module enclosure() {
    difference() {
        // Main box, centered on XY, sitting on Z=0
        translate([0, 0, box_height / 2])
        cube([box_width, box_length, box_height], center = true);
        
        // Arch cutout from bottom
        translate([0, 0, 0])
        elliptical_arch();
    }
}

enclosure();

// === NOTES ===
// - The arch is cut from the bottom of the box
// - Adjust arch_radius_x to change how wide the opening is
// - Adjust arch_radius_y to change curvature along the headband direction
//   (larger value = flatter/more gradual curve along length)
// - Set simple_arch = true if you want a uniform tunnel instead of a dome
// - The enclosure sits flat on the build plate (Z=0 is the bottom)
