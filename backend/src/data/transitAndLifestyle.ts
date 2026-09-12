export type GeoPoint = [number, number];
export type NetworkStatus = "operational" | "partially_operational" | "under_construction" | "planned";

export type MetroLineRecord = {
  city: string;
  id: string;
  name: string;
  color: string;
  status: NetworkStatus;
  stations: string[];
  operational_stations?: string[];
  source_url: string;
  source_note: string;
};

export type ProximityPoint = {
  city: string;
  name: string;
  category: "metro" | "bus" | "cafe" | "bakery" | "coffee_roaster" | "microbrewery" | "club" | "late_night_cafe" | "tech_hub";
  coordinates: GeoPoint;
  line_or_route?: string;
  locality?: string;
  operator?: string;
  address?: string;
  source_url?: string;
  coordinate_precision: "station_centroid" | "venue_centroid" | "locality_centroid" | "approximate_public_centroid";
};

export type BusRouteRecord = {
  city: string;
  operator: string;
  route: string;
  service_type: string;
  origin: string;
  destination: string;
  stops: string[];
  source_url: string;
};

const KOLKATA_BLUE = [
  "Dakshineswar","Baranagar","Noapara","Dum Dum","Belgachia","Shyambazar","Shobhabazar Sutanuti","Girish Park","Mahatma Gandhi Road","Central","Chandni Chowk","Esplanade","Park Street","Maidan","Rabindra Sadan","Netaji Bhavan","Jatin Das Park","Kalighat","Rabindra Sarobar","Mahanayak Uttam Kumar","Netaji","Masterda Surya Sen","Gitanjali","Kavi Nazrul","Shahid Khudiram","Kavi Subhash"
];
const KOLKATA_GREEN = ["Salt Lake Sector V","Karunamoyee","Central Park","City Centre","Bengal Chemical","Salt Lake Stadium","Phoolbagan","Sealdah","Esplanade","Mahakaran","Howrah","Howrah Maidan"];
const KOLKATA_ORANGE = ["Kavi Subhash","Satyajit Ray","Jyotirindra Nandi","Kavi Sukanta","Hemanta Mukhopadhyay","VIP Bazar","Ritwik Ghatak","Barun Sengupta","Beleghata","Gour Kishor Ghosh","Nalban","IT Centre","Nabadiganta","Nazrul Tirtha","Swapnobhor","Biswa Bangla Convention Centre","Shiksha Tirtha","Mother's Wax Museum","Eco Park","Mangaldeep","City Centre 2","Chinar Park","VIP Road","Jai Hind"];
const KOLKATA_PURPLE = ["Joka","Thakurpukur","Sakher Bazar","Behala Chowrasta","Behala Bazar","Taratala","Majerhat"];
const KOLKATA_YELLOW = ["Noapara","Dum Dum Cantonment","Jessore Road","Jai Hind"];

const BENGALURU_PURPLE = ["Whitefield (Kadugodi)","Hopefarm Channasandra","Kadugodi Tree Park","Pattandur Agrahara","Sri Sathya Sai Hospital","Nallurhalli","Kundalahalli","Seetharampalya","Hoodi","Garudacharpalya","Singayyanapalya","Krishnarajapura","Benniganahalli","Baiyappanahalli","Swami Vivekananda Road","Indiranagar","Halasuru","Trinity","Mahatma Gandhi Road","Cubbon Park","Dr. B. R. Ambedkar Station, Vidhana Soudha","Sir M. Visvesvaraya Station, Central College","Nadaprabhu Kempegowda Station, Majestic","Krantivira Sangolli Rayanna Railway Station","Magadi Road","Sri Balagangadharanatha Swamiji Station, Hosahalli","Vijayanagar","Attiguppe","Deepanjali Nagar","Mysore Road","Nayandahalli","Rajarajeshwari Nagar","Jnanabharathi","Pattanagere","Kengeri Bus Terminal","Kengeri","Challaghatta"];
const BENGALURU_YELLOW = ["Rashtreeya Vidyalaya Road","Ragigudda","Jayadeva Hospital","BTM Layout","Central Silk Board","Bommanahalli","Hongasandra","Kudlu Gate","Singasandra","Hosa Road","Beratena Agrahara","Electronic City","Infosys Foundation Konappana Agrahara","Huskur Road","Biocon Hebbagodi","Delta Electronics Bommasandra"];
const BENGALURU_BLUE = ["Central Silk Board","HSR Layout","Agara","Ibbalur","Bellandur","Kadubeesanahalli","Kodibisanahalli","Marathahalli","ISRO","Doddanekundi","DRDO Sports Complex","Saraswathi Nagar","Krishnarajapura","Kasturi Nagar","Horamavu","HRBR Layout","Kalyan Nagar","HBR Layout","Nagawara","Veerannapalya","Kempapura","Hebbal","Kodigehalli","Jakkur Cross","Yelahanka","Bagalur Cross","Bettahalasuru","Doddajala","Airport City","Kempegowda International Airport"];

const MUMBAI_LINE1 = ["Versova","D. N. Nagar","Azad Nagar","Andheri","Western Express Highway","Chakala","Airport Road","Marol Naka","Sakinaka","Asalpha Road","Jagruti Nagar","Ghatkopar"];
const MUMBAI_AQUA = ["Cuffe Parade","Vidhan Bhavan","Churchgate Metro","Hutatma Chowk","Chhatrapati Shivaji Maharaj Terminus Metro","Kalbadevi","Girgaon","Grant Road Metro","Jagannath Shankar Sheth Metro","Mahalaxmi Metro","Science Centre","Acharya Atre Chowk","Worli","Siddhivinayak","Dadar Metro","Shitala Devi Mandir","Dharavi","Bandra-Kurla Complex","Bandra Colony","Santacruz Metro","Chhatrapati Shivaji Maharaj International Airport T1","Sahar Road","Chhatrapati Shivaji Maharaj International Airport T2","Marol Naka","MIDC-Andheri","SEEPZ","Aarey JVLR"];

const PUNE_LINE1 = ["PCMC","Sant Tukaram Nagar","Bhosari (Nashik Phata)","Kasarwadi","Phugewadi","Dapodi","Bopodi","Khadki","Range Hill","Shivaji Nagar","Civil Court","Kasba Peth","Mahatma Phule Mandai","Swargate"];
const PUNE_LINE2 = ["Vanaz","Anand Nagar","Paud Phata","S.N.D.T College","Garware College","Deccan Gymkhana","Chhatrapati Sambhaji Udyan","PMC","Civil Court","RTO Pune","Pune Railway Station","Ruby Hall Clinic","Bund Garden","Yerawada","Kalyani Nagar","Ramwadi"];
const PUNE_LINE3 = ["Maan","PMR-2","PMR-3","PMR-4","PMR-5","PMR-6","Hinjawadi","PMR-8","Wakad Chowk","Balewadi Stadium","PMR-11","Ram Nagar","Laxmi Nagar","Balewadi Phata","Baner Gaon","Baner","Krushi Anusandhan","YASHADA","Savitribai Phule Pune University","RBI","Agriculture College","Shivajinagar","Civil Court"];

const DELHI_RED = ["Rithala","Rohini West","Rohini East","Pitampura","Kohat Enclave","Netaji Subhash Place","Keshav Puram","Kanhaiya Nagar","Inderlok","Shastri Nagar","Pratap Nagar","Pul Bangash","Tis Hazari","Kashmere Gate","Shastri Park","Seelampur","Welcome","Shahdara","Mansarovar Park","Jhilmil","Dilshad Garden","Shaheed Nagar","Raj Bagh","Major Mohit Sharma Rajendra Nagar","Shyam Park","Mohan Nagar","Arthala","Hindon River","Shaheed Sthal"];
const DELHI_YELLOW = ["Samaypur Badli","Rohini Sector 18, 19","Haiderpur Badli Mor","Jahangirpuri","Adarsh Nagar","Azadpur","Model Town","GTB Nagar","Vishwavidyalaya","Vidhan Sabha","Civil Lines","Kashmere Gate","Chandni Chowk","Chawri Bazar","New Delhi","Rajiv Chowk","Patel Chowk","Central Secretariat","Udyog Bhawan","Lok Kalyan Marg","Jor Bagh","Dilli Haat INA","AIIMS","Green Park","Hauz Khas","Malviya Nagar","Saket","Qutub Minar","Chhatarpur","Sultanpur","Ghitorni","Arjan Garh","Guru Dronacharya","Sikanderpur","MG Road","IFFCO Chowk","Millennium City Centre Gurugram"];
const DELHI_BLUE_MAIN = ["Dwarka Sector 21","Dwarka Sector 8","Dwarka Sector 9","Dwarka Sector 10","Dwarka Sector 11","Dwarka Sector 12","Dwarka Sector 13","Dwarka Sector 14","Dwarka","Dwarka Mor","Nawada","Uttam Nagar West","Uttam Nagar East","Janakpuri West","Janakpuri East","Tilak Nagar","Subhash Nagar","Tagore Garden","Rajouri Garden","Ramesh Nagar","Moti Nagar","Kirti Nagar","Shadipur","Patel Nagar","Rajendra Place","Karol Bagh","Jhandewalan","Ramakrishna Ashram Marg","Rajiv Chowk","Barakhamba Road","Mandi House","Supreme Court","Indraprastha","Yamuna Bank","Akshardham","Mayur Vihar-I","Mayur Vihar Extension","New Ashok Nagar","Noida Sector 15","Noida Sector 16","Noida Sector 18","Botanical Garden","Golf Course","Noida City Centre","Noida Sector 34","Noida Sector 52","Noida Sector 61","Noida Sector 59","Noida Sector 62","Noida Electronic City"];
const DELHI_BLUE_BRANCH = ["Yamuna Bank","Laxmi Nagar","Nirman Vihar","Preet Vihar","Karkarduma","Anand Vihar ISBT","Kaushambi","Vaishali"];
const DELHI_GREEN = ["Kirti Nagar","Satguru Ram Singh Marg","Inderlok","Ashok Park Main","Punjabi Bagh","Shivaji Park","Madipur","Paschim Vihar East","Paschim Vihar West","Peera Garhi","Udyog Nagar","Maharaja Surajmal Stadium","Nangloi","Nangloi Railway Station","Rajdhani Park","Mundka","Mundka Industrial Area","Ghevra Metro Station","Tikri Kalan","Tikri Border","Pandit Shree Ram Sharma","Bahadurgarh City","Brigadier Hoshiar Singh"];
const DELHI_VIOLET = ["Kashmere Gate","Lal Qila","Jama Masjid","Delhi Gate","ITO","Mandi House","Janpath","Central Secretariat","Khan Market","Jawaharlal Nehru Stadium","Jangpura","Lajpat Nagar","Moolchand","Kailash Colony","Nehru Place","Kalkaji Mandir","Govind Puri","Harkesh Nagar Okhla","Jasola Apollo","Sarita Vihar","Mohan Estate","Tughlakabad Station","Badarpur Border","Sarai","NHPC Chowk","Mewla Maharajpur","Sector 28","Badkal Mor","Old Faridabad","Neelam Chowk Ajronda","Bata Chowk","Escorts Mujesar","Sant Surdas (Sihi)","Raja Nahar Singh"];
const DELHI_PINK = ["Majlis Park","Azadpur","Shalimar Bagh","Netaji Subhash Place","Shakurpur","Punjabi Bagh West","ESI-Basaidarapur","Rajouri Garden","Mayapuri","Naraina Vihar","Delhi Cantt","Durgabai Deshmukh South Campus","Sir M. Vishweshwaraiah Moti Bagh","Bhikaji Cama Place","Sarojini Nagar","Dilli Haat INA","South Extension","Lajpat Nagar","Vinobapuri","Ashram","Sarai Kale Khan-Nizamuddin","Mayur Vihar-I","Mayur Vihar Pocket I","Trilokpuri Sanjay Lake","East Vinod Nagar-Mayur Vihar-II","Mandawali-West Vinod Nagar","IP Extension","Anand Vihar ISBT","Karkarduma","Karkarduma Court","Krishna Nagar","East Azad Nagar","Welcome","Jaffrabad","Maujpur-Babarpur","Gokulpuri","Johri Enclave","Shiv Vihar"];
const DELHI_MAGENTA = ["Krishna Park Extension","Janakpuri West","Dabri Mor-Janakpuri South","Dashrath Puri","Palam","Sadar Bazaar Cantonment","Terminal 1-IGI Airport","Shankar Vihar","Vasant Vihar","Munirka","RK Puram","IIT Delhi","Hauz Khas","Panchsheel Park","Chirag Delhi","Greater Kailash","Nehru Enclave","Kalkaji Mandir","Okhla NSIC","Sukhdev Vihar","Jamia Millia Islamia","Okhla Vihar","Jasola Vihar Shaheen Bagh","Kalindi Kunj","Okhla Bird Sanctuary","Botanical Garden"];
const DELHI_GREY = ["Dwarka","Nangli","Najafgarh","Dhansa Bus Stand"];
const DELHI_AIRPORT = ["New Delhi","Shivaji Stadium","Dhaula Kuan","Delhi Aerocity","IGI Airport","Dwarka Sector 21","Yashobhoomi Dwarka Sector 25"];
const NOIDA_AQUA = ["Noida Sector 51","Noida Sector 50","Noida Sector 76","Noida Sector 101","Noida Sector 81","NSEZ","Noida Sector 83","Noida Sector 137","Noida Sector 142","Noida Sector 143","Noida Sector 144","Noida Sector 145","Noida Sector 146","Noida Sector 147","Noida Sector 148","Knowledge Park II","Pari Chowk","Alpha 1","Delta 1","GNIDA Office","Depot"];
const GURUGRAM_RAPID = ["Sector 55-56","Sector 54 Chowk","Sector 53-54","Sector 42-43","Phase 1","Sikanderpur","Phase 2","Belvedere Towers","Cyber City","Moulsari Avenue","Phase 3"];

export const METRO_LINES: MetroLineRecord[] = [
  {city:"Kolkata",id:"kol-blue",name:"Blue Line",color:"blue",status:"operational",stations:KOLKATA_BLUE,source_url:"https://mtp.indianrailways.gov.in/",source_note:"Metro Railway Kolkata passenger information and operating rules."},
  {city:"Kolkata",id:"kol-green",name:"Green Line (East-West)",color:"green",status:"operational",stations:KOLKATA_GREEN,source_url:"https://mtp.indianrailways.gov.in/",source_note:"Metro Railway Kolkata Green Line station table; through corridor completed in stages."},
  {city:"Kolkata",id:"kol-orange",name:"Orange Line",color:"orange",status:"partially_operational",stations:KOLKATA_ORANGE,operational_stations:KOLKATA_ORANGE.slice(0,9),source_url:"https://mtp.indianrailways.gov.in/",source_note:"Kavi Subhash-Beleghata commissioned; full airport corridor retained with partial-operation status."},
  {city:"Kolkata",id:"kol-purple",name:"Purple Line",color:"purple",status:"partially_operational",stations:KOLKATA_PURPLE,operational_stations:KOLKATA_PURPLE,source_url:"https://mtp.indianrailways.gov.in/",source_note:"Joka-Majerhat operational segment of the Joka-Esplanade corridor."},
  {city:"Kolkata",id:"kol-yellow",name:"Yellow Line",color:"yellow",status:"partially_operational",stations:KOLKATA_YELLOW,operational_stations:KOLKATA_YELLOW,source_url:"https://mtp.indianrailways.gov.in/",source_note:"Noapara-Jai Hind airport section commissioned in FY 2025-26."},
  {city:"Bengaluru",id:"blr-purple",name:"Purple Line",color:"purple",status:"operational",stations:BENGALURU_PURPLE,source_url:"https://english.bmrc.co.in/",source_note:"Namma Metro Purple Line network catalogue."},
  {city:"Bengaluru",id:"blr-yellow",name:"Yellow Line",color:"yellow",status:"operational",stations:BENGALURU_YELLOW,source_url:"https://english.bmrc.co.in/",source_note:"RV Road-Bommasandra corridor opened in August 2025."},
  {city:"Bengaluru",id:"blr-blue",name:"Blue Line",color:"blue",status:"under_construction",stations:BENGALURU_BLUE,source_url:"https://english.bmrc.co.in/",source_note:"Phase 2A/2B ORR-airport corridor; do not present as operational until BMRCL publishes commissioning."},
  {city:"Mumbai",id:"mum-line-1",name:"Metro Line 1",color:"blue",status:"operational",stations:MUMBAI_LINE1,source_url:"https://www.mmrda.maharashtra.gov.in/en/projects/transport/metro-line-1/overview",source_note:"MMRDA published 12-station Versova-Andheri-Ghatkopar corridor."},
  {city:"Mumbai",id:"mum-aqua",name:"Metro Line 3 (Aqua)",color:"aqua",status:"partially_operational",stations:MUMBAI_AQUA,source_url:"https://mmrcl.com/",source_note:"Full statutory 27-station corridor catalogue; operation status is kept conservative because openings occurred in phases."},
  {city:"Pune",id:"pune-line-1",name:"Corridor 1",color:"purple",status:"operational",stations:PUNE_LINE1,source_url:"https://www.punemetrorail.org/route-map.aspx?lang=en-US",source_note:"PCMC-Swargate corridor from official Pune Metro route map."},
  {city:"Pune",id:"pune-line-2",name:"Corridor 2",color:"aqua",status:"operational",stations:PUNE_LINE2,source_url:"https://www.punemetrorail.org/route-map.aspx?lang=en-US",source_note:"Vanaz-Ramwadi corridor from official Pune Metro route map."},
  {city:"Pune",id:"pune-line-3",name:"Line 3 (Maan-Hinjawadi-Shivajinagar)",color:"red",status:"under_construction",stations:PUNE_LINE3,source_url:"https://www.pmrda.gov.in/en/pune-metro-line-3/",source_note:"23-station PMRDA Line 3; current PMRDA status remains project/construction status, not assumed fully operational."},
  {city:"Delhi NCR",id:"del-red",name:"Red Line",color:"red",status:"operational",stations:DELHI_RED,source_url:"https://delhimetrorail.com/",source_note:"DMRC January 2026 operational network."},
  {city:"Delhi NCR",id:"del-yellow",name:"Yellow Line",color:"yellow",status:"operational",stations:DELHI_YELLOW,source_url:"https://delhimetrorail.com/",source_note:"DMRC January 2026 operational network."},
  {city:"Delhi NCR",id:"del-blue-main",name:"Blue Line - Main",color:"blue",status:"operational",stations:DELHI_BLUE_MAIN,source_url:"https://delhimetrorail.com/",source_note:"DMRC Line 3 operational network."},
  {city:"Delhi NCR",id:"del-blue-branch",name:"Blue Line - Vaishali Branch",color:"blue",status:"operational",stations:DELHI_BLUE_BRANCH,source_url:"https://delhimetrorail.com/",source_note:"DMRC Line 4 operational branch."},
  {city:"Delhi NCR",id:"del-green",name:"Green Line",color:"green",status:"operational",stations:DELHI_GREEN,source_url:"https://delhimetrorail.com/",source_note:"DMRC January 2026 operational network."},
  {city:"Delhi NCR",id:"del-violet",name:"Violet Line",color:"violet",status:"operational",stations:DELHI_VIOLET,source_url:"https://delhimetrorail.com/",source_note:"DMRC January 2026 operational network."},
  {city:"Delhi NCR",id:"del-pink",name:"Pink Line",color:"pink",status:"operational",stations:DELHI_PINK,source_url:"https://delhimetrorail.com/",source_note:"DMRC January 2026 operational network."},
  {city:"Delhi NCR",id:"del-magenta",name:"Magenta Line",color:"magenta",status:"operational",stations:DELHI_MAGENTA,source_url:"https://delhimetrorail.com/",source_note:"Includes Krishna Park Extension commissioned section shown on the January 2026 DMRC map."},
  {city:"Delhi NCR",id:"del-grey",name:"Grey Line",color:"grey",status:"operational",stations:DELHI_GREY,source_url:"https://delhimetrorail.com/",source_note:"DMRC January 2026 operational network."},
  {city:"Delhi NCR",id:"del-airport",name:"Airport Express",color:"orange",status:"operational",stations:DELHI_AIRPORT,source_url:"https://delhimetrorail.com/",source_note:"New Delhi-Yashobhoomi Dwarka Sector 25 airport corridor."},
  {city:"Delhi NCR",id:"noida-aqua",name:"Noida Aqua Line",color:"aqua",status:"operational",stations:NOIDA_AQUA,source_url:"https://delhimetrorail.com/",source_note:"NMRC line shown under other NCR metros on DMRC network map."},
  {city:"Delhi NCR",id:"gurugram-rapid",name:"Rapid Metro Gurugram",color:"blue",status:"operational",stations:GURUGRAM_RAPID,source_url:"https://delhimetrorail.com/",source_note:"Rapid Metro shown under other NCR metros on DMRC network map."}
];

export const BUS_ROUTES: BusRouteRecord[] = [
  {city:"Kolkata",operator:"WBTC",route:"AC-9B",service_type:"AC city bus",origin:"Jadavpore",destination:"Eco Space",stops:["Jadavpore","Ajoynagar","Science City","Chingrihata","SDF","College More","New Town","Narkel Bagan","Eco Space"],source_url:"https://wbtconline.in/home"},
  {city:"Kolkata",operator:"WBTC",route:"AC-23A",service_type:"AC city bus",origin:"Salt Lake Depot Gate",destination:"Rajchandrapur",stops:["College More","New Town","Unitech","Eco Space","Aliah University","Eco Park","City Centre II","Airport Gate No. 1","Dakshineswar"],source_url:"https://wbtconline.in/home"},
  {city:"Kolkata",operator:"WBTC",route:"AC-30S (IT Spl.)",service_type:"AC IT special",origin:"Ultadanga",destination:"Sapoorji",stops:["Ultadanga","Chingrihata","SDF","College More","New Town Bus Terminus","Narkel Bagan","Unitech","Sapoorji"],source_url:"https://wbtconline.in/home"},
  {city:"Bengaluru",operator:"BMTC",route:"500D/23",service_type:"ORR trunk/Vajra corridor",origin:"Hebbal",destination:"Central Silk Board",stops:["Hebbal","Manyata Tech Park","Nagawara","Kalyan Nagar","Tin Factory","KR Pura","Marathahalli","Kadubeesanahalli","Bellandur","Agara","HSR Layout","Central Silk Board"],source_url:"https://saiindia.gov.in/"},
  {city:"Bengaluru",operator:"BMTC",route:"V-500CA",service_type:"Vajra AC Volvo",origin:"ITPL",destination:"Banashankari TTMC",stops:["ITPL","Pattandur Agrahara","Sathya Sai Hospital","Kundalahalli","Marathahalli Bridge","Kadubeesanahalli","Eco Space","Bellandur","Agara","HSR Layout","Central Silk Board","BTM Layout","Jayadeva Hospital","Banashankari TTMC"],source_url:"https://www.bmtcvolvo.com/"},
  {city:"Bengaluru",operator:"BMTC",route:"V-335E",service_type:"Vajra AC Volvo",origin:"Majestic",destination:"Kadugodi",stops:["Majestic","KR Circle","Richmond Circle","Mayo Hall","Domlur","HAL","Marathahalli","Kundalahalli","ITPL","Hope Farm","Kadugodi"],source_url:"https://www.bmtcvolvo.com/"},
  {city:"Mumbai",operator:"BEST",route:"BKC-22",service_type:"AC BKC shuttle",origin:"Kurla Station West",destination:"SEBI/BKC",stops:["Kurla Station West","Kapadia Nagar","BKC","Diamond Market","Canara Bank","SEBI/BKC"],source_url:"https://www.bestundertaking.com/assets/pdf/mmrconnect.pdf"},
  {city:"Mumbai",operator:"BEST",route:"BKC-23",service_type:"AC BKC shuttle",origin:"Bandra Railway Terminus",destination:"CA Institute/BKC",stops:["Bandra Railway Terminus","Kala Nagar","MMRDA","RBI Bank","Bharat Nagar","Canara Bank","CA Institute/BKC"],source_url:"https://www.bestundertaking.com/assets/pdf/mmrconnect.pdf"},
  {city:"Pune",operator:"PMPML",route:"333",service_type:"city bus",origin:"Hinjawadi",destination:"Pune",stops:["Hinjawadi","Wakad","Aundh","Shivajinagar","Pune"],source_url:"https://www.pcmcindia.gov.in/sutp/by_pmpml.html"},
  {city:"Pune",operator:"PMPML",route:"372",service_type:"IT corridor bus",origin:"Nigdi",destination:"Hinjawadi",stops:["Nigdi","Wakad","Hinjawadi"],source_url:"https://www.pcmcindia.gov.in/sutp/by_pmpml.html"}
];

export const PROXIMITY_POINTS: ProximityPoint[] = [
  {city:"Kolkata",name:"Salt Lake Sector V",category:"metro",coordinates:[88.4335,22.5762],line_or_route:"Green Line",coordinate_precision:"station_centroid"},
  {city:"Kolkata",name:"Central Park",category:"metro",coordinates:[88.4142,22.5851],line_or_route:"Green Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Sealdah",category:"metro",coordinates:[88.3712,22.5677],line_or_route:"Green Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Esplanade",category:"metro",coordinates:[88.3503,22.5645],line_or_route:"Blue / Green",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Howrah",category:"metro",coordinates:[88.3428,22.5839],line_or_route:"Green Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Kavi Subhash",category:"metro",coordinates:[88.4122,22.4696],line_or_route:"Blue / Orange",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Hemanta Mukhopadhyay",category:"metro",coordinates:[88.4007,22.5161],line_or_route:"Orange Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Noapara",category:"metro",coordinates:[88.3926,22.6393],line_or_route:"Blue / Yellow",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Jai Hind (Airport)",category:"metro",coordinates:[88.4467,22.6509],line_or_route:"Yellow Line",coordinate_precision:"approximate_public_centroid"},

  {city:"Bengaluru",name:"Whitefield (Kadugodi)",category:"metro",coordinates:[77.7576,12.9954],line_or_route:"Purple Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Krishnarajapura",category:"metro",coordinates:[77.6954,13.0005],line_or_route:"Purple Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Indiranagar",category:"metro",coordinates:[77.6385,12.9784],line_or_route:"Purple Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Mahatma Gandhi Road",category:"metro",coordinates:[77.6068,12.9756],line_or_route:"Purple Line",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Nadaprabhu Kempegowda Station, Majestic",category:"metro",coordinates:[77.5713,12.9772],line_or_route:"Purple / Green",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Rashtreeya Vidyalaya Road",category:"metro",coordinates:[77.5801,12.9215],line_or_route:"Yellow / Green",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Central Silk Board",category:"metro",coordinates:[77.6227,12.9175],line_or_route:"Yellow / future Blue",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Electronic City",category:"metro",coordinates:[77.6642,12.8455],line_or_route:"Yellow Line",coordinate_precision:"approximate_public_centroid"},

  {city:"Mumbai",name:"Versova",category:"metro",coordinates:[72.8146,19.1306],line_or_route:"Line 1",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"Andheri",category:"metro",coordinates:[72.8490,19.1202],line_or_route:"Line 1",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"Ghatkopar",category:"metro",coordinates:[72.9082,19.0861],line_or_route:"Line 1",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"Bandra-Kurla Complex",category:"metro",coordinates:[72.8684,19.0633],line_or_route:"Line 3 Aqua",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"Marol Naka",category:"metro",coordinates:[72.8812,19.1086],line_or_route:"Line 1 / Line 3",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"SEEPZ",category:"metro",coordinates:[72.8737,19.1268],line_or_route:"Line 3 Aqua",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"Aarey JVLR",category:"metro",coordinates:[72.8846,19.1305],line_or_route:"Line 3 Aqua",coordinate_precision:"approximate_public_centroid"},

  {city:"Pune",name:"PCMC",category:"metro",coordinates:[73.8031,18.6298],line_or_route:"Corridor 1",coordinate_precision:"approximate_public_centroid"},
  {city:"Pune",name:"Civil Court",category:"metro",coordinates:[73.8564,18.5295],line_or_route:"Corridor 1 / Corridor 2",coordinate_precision:"approximate_public_centroid"},
  {city:"Pune",name:"Ramwadi",category:"metro",coordinates:[73.9143,18.5627],line_or_route:"Corridor 2",coordinate_precision:"approximate_public_centroid"},
  {city:"Pune",name:"Hinjawadi",category:"metro",coordinates:[73.7389,18.5913],line_or_route:"Line 3",coordinate_precision:"locality_centroid"},
  {city:"Pune",name:"Baner",category:"metro",coordinates:[73.7868,18.5590],line_or_route:"Line 3",coordinate_precision:"locality_centroid"},

  {city:"Delhi NCR",name:"Rajiv Chowk",category:"metro",coordinates:[77.2180,28.6328],line_or_route:"Blue / Yellow",coordinate_precision:"approximate_public_centroid"},
  {city:"Delhi NCR",name:"New Delhi",category:"metro",coordinates:[77.2207,28.6430],line_or_route:"Yellow / Airport Express",coordinate_precision:"approximate_public_centroid"},
  {city:"Delhi NCR",name:"Hauz Khas",category:"metro",coordinates:[77.2063,28.5433],line_or_route:"Yellow / Magenta",coordinate_precision:"approximate_public_centroid"},
  {city:"Delhi NCR",name:"Cyber City",category:"metro",coordinates:[77.0889,28.4949],line_or_route:"Rapid Metro",coordinate_precision:"approximate_public_centroid"},
  {city:"Delhi NCR",name:"Noida Electronic City",category:"metro",coordinates:[77.3752,28.6280],line_or_route:"Blue Line",coordinate_precision:"approximate_public_centroid"},

  {city:"Kolkata",name:"College More / Sector V",category:"bus",coordinates:[88.4308,22.5770],line_or_route:"WBTC AC-9B / AC-23A / AC-30S",operator:"WBTC",coordinate_precision:"approximate_public_centroid"},
  {city:"Kolkata",name:"Eco Space",category:"bus",coordinates:[88.4820,22.5885],line_or_route:"WBTC AC-9B / AC-23A",operator:"WBTC",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Central Silk Board Bus Stop",category:"bus",coordinates:[77.6227,12.9175],line_or_route:"BMTC 500D / V-500CA",operator:"BMTC",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"ITPL Bus Stop",category:"bus",coordinates:[77.7377,12.9855],line_or_route:"BMTC V-500CA / V-335E",operator:"BMTC",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"BKC Diamond Market",category:"bus",coordinates:[72.8677,19.0675],line_or_route:"BEST BKC routes",operator:"BEST",coordinate_precision:"approximate_public_centroid"},
  {city:"Pune",name:"Hinjawadi Bus Hub",category:"bus",coordinates:[73.7389,18.5913],line_or_route:"PMPML 333 / 372",operator:"PMPML",coordinate_precision:"locality_centroid"},

  {city:"Kolkata",name:"Blue Tokai Coffee Roasters - Sector 5 Salt Lake",category:"coffee_roaster",coordinates:[88.4314,22.5825],locality:"Sector V",address:"Mahisbathan Road, Sector 5, Salt Lake",source_url:"https://stores.bluetokaicoffee.com/",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Ganbeii Microbrewery",category:"microbrewery",coordinates:[77.6155,12.9346],locality:"Koramangala",address:"Jyoti Nivas College Road, 5th Block, Koramangala",source_url:"https://ganbeii.in/",coordinate_precision:"approximate_public_centroid"},
  {city:"Bengaluru",name:"Blue Tokai Coffee Roasters - RMZ Ecoworld",category:"coffee_roaster",coordinates:[77.6849,12.9277],locality:"Bellandur",address:"RMZ Ecoworld, Bengaluru",source_url:"https://stores.bluetokaicoffee.com/",coordinate_precision:"approximate_public_centroid"},
  {city:"Pune",name:"Blue Tokai Coffee Roasters - Koregaon Park",category:"coffee_roaster",coordinates:[73.8953,18.5362],locality:"Koregaon Park",source_url:"https://stores.bluetokaicoffee.com/",coordinate_precision:"approximate_public_centroid"},
  {city:"Pune",name:"Night Owl Cafe",category:"late_night_cafe",coordinates:[73.9155,18.6060],locality:"Lohegaon",address:"Porwal Road, Pune",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"Starbucks - Maker Maxity BKC",category:"cafe",coordinates:[72.8680,19.0609],locality:"Bandra Kurla Complex",address:"Maker Maxity, BKC",coordinate_precision:"approximate_public_centroid"},
  {city:"Mumbai",name:"The Berliner Bar",category:"microbrewery",coordinates:[72.8148,19.1322],locality:"Versova",address:"JP Road, Versova, Andheri West",coordinate_precision:"approximate_public_centroid"},
  {city:"Delhi NCR",name:"Cyber Hub SOCIAL",category:"club",coordinates:[77.0889,28.4949],locality:"DLF Cyber City",address:"DLF Cyber Hub, Gurugram",source_url:"https://socialoffline.in/",coordinate_precision:"venue_centroid"},

  {city:"Kolkata",name:"Sector V IT Hub",category:"tech_hub",coordinates:[88.4335,22.5762],locality:"Sector V",coordinate_precision:"locality_centroid"},
  {city:"Kolkata",name:"New Town Business District",category:"tech_hub",coordinates:[88.4798,22.5797],locality:"New Town",coordinate_precision:"locality_centroid"},
  {city:"Bengaluru",name:"Manyata Tech Park",category:"tech_hub",coordinates:[77.6209,13.0456],locality:"Nagawara",coordinate_precision:"locality_centroid"},
  {city:"Bengaluru",name:"International Tech Park Whitefield",category:"tech_hub",coordinates:[77.7377,12.9855],locality:"Whitefield",coordinate_precision:"locality_centroid"},
  {city:"Bengaluru",name:"Electronic City",category:"tech_hub",coordinates:[77.6642,12.8399],locality:"Electronic City",coordinate_precision:"locality_centroid"},
  {city:"Pune",name:"Rajiv Gandhi Infotech Park Hinjawadi",category:"tech_hub",coordinates:[73.7389,18.5913],locality:"Hinjawadi",coordinate_precision:"locality_centroid"},
  {city:"Pune",name:"EON IT Park Kharadi",category:"tech_hub",coordinates:[73.9472,18.5514],locality:"Kharadi",coordinate_precision:"locality_centroid"},
  {city:"Mumbai",name:"Bandra Kurla Complex",category:"tech_hub",coordinates:[72.8684,19.0633],locality:"BKC",coordinate_precision:"locality_centroid"},
  {city:"Mumbai",name:"SEEPZ",category:"tech_hub",coordinates:[72.8737,19.1268],locality:"Andheri East",coordinate_precision:"locality_centroid"},
  {city:"Delhi NCR",name:"DLF Cyber City",category:"tech_hub",coordinates:[77.0889,28.4949],locality:"Gurugram",coordinate_precision:"locality_centroid"},
  {city:"Delhi NCR",name:"Noida Sector 62 IT Hub",category:"tech_hub",coordinates:[77.3649,28.6273],locality:"Noida Sector 62",coordinate_precision:"locality_centroid"}
];

export const DATASET_VERIFIED_AT = "2026-09-12";

export function normalizeTransitCity(city: string): string {
  const value = city.trim().toLowerCase();
  if (value.includes("bangalore") || value.includes("bengaluru")) return "Bengaluru";
  if (value.includes("delhi") || value.includes("gurugram") || value.includes("gurgaon") || value.includes("noida")) return "Delhi NCR";
  if (value.includes("kolkata") || value.includes("calcutta")) return "Kolkata";
  if (value.includes("mumbai") || value.includes("bombay")) return "Mumbai";
  if (value.includes("pune")) return "Pune";
  return city.trim();
}
