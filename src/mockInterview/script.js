document.addEventListener('DOMContentLoaded', function() {
    // Initialize FullCalendar
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        nowIndicator: true,
        editable: false,
        selectable: true,
        initialDate: new Date(), // Set to current date
        events: [
            {
                title: 'Booked - Sarah Johnson',
                start: new Date(new Date().setHours(11, 0, 0)),
                end: new Date(new Date().setHours(12, 0, 0)),
                color: '#e0a800'
            },
            {
                title: 'Booked - Michael Chen',
                start: new Date(new Date().setDate(new Date().getDate() + 1)),
                end: new Date(new Date().setDate(new Date().getDate() + 1)),
                color: '#e0a800'
            },
            {
                title: 'Booked - Aisha Patel',
                start: new Date(new Date().setDate(new Date().getDate() + 2)),
                end: new Date(new Date().setDate(new Date().getDate() + 2)),
                color: '#e0a800'
            },
            {
                title: 'Booked - Sarah Johnson',
                start: new Date(new Date().setDate(new Date().getDate() + 3)),
                end: new Date(new Date().setDate(new Date().getDate() + 3)),
                color: '#e0a800'
            }
        ],
        eventClick: function(info) {
            alert('This slot is already booked: ' + info.event.title);
            info.jsEvent.preventDefault();
        },
        dateClick: function(info) {
            document.getElementById('interview-date').value = info.dateStr;
            // Show time slots when date is selected
            document.getElementById('time-section').style.display = 'block';
        },
        eventDidMount: function(info) {
            // Style events
            info.el.style.border = 'none';
            info.el.style.borderRadius = '4px';
            info.el.style.padding = '2px 5px';
        }
    });
    calendar.render();
    
    // Modal functionality
    var modal = document.getElementById('booking-modal');
    var closeBtn = document.getElementsByClassName('close')[0];
    var bookBtns = document.querySelectorAll('.book-btn');
    var bookingForm = document.getElementById('booking-form');
    var timeSection = document.getElementById('time-section');
    var interviewDateInput = document.getElementById('interview-date');
    var confirmationMessage = document.getElementById('confirmation-message');
    var timeSlots = document.querySelectorAll('.time-slot');
    
    bookBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            modal.style.display = 'block';
            document.getElementById('interviewer').value = this.getAttribute('data-interviewer');
            bookingForm.style.display = 'block';
            confirmationMessage.style.display = 'none';
            // Reset form
            bookingForm.reset();
            timeSection.style.display = 'none';
            // Clear any selected time slots
            timeSlots.forEach(function(slot) {
                slot.classList.remove('selected');
            });
        });
    });
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };
    
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
    
    interviewDateInput.addEventListener('change', function() {
        timeSection.style.display = 'block';
    });
    
    timeSlots.forEach(function(slot) {
        if (!slot.classList.contains('booked')) {
            slot.addEventListener('click', function() {
                timeSlots.forEach(function(s) {
                    s.classList.remove('selected');
                });
                slot.classList.add('selected');
            });
        }
    });
    
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Simulate booking process
        bookingForm.style.display = 'none';
        confirmationMessage.style.display = 'block';
        
        // Add the new booking to the calendar
        var selectedDate = document.getElementById('interview-date').value;
        var selectedInterviewer = document.getElementById('interviewer').value;
        var selectedTimeSlot = document.querySelector('.time-slot.selected');
        
        if (selectedTimeSlot) {
            var time = selectedTimeSlot.getAttribute('data-time');
            var startTime = selectedDate + 'T' + time + ':00';
            var endHour = parseInt(time.split(':')[0]) + 1;
            var endTime = selectedDate + 'T' + (endHour < 10 ? '0' + endHour : endHour) + ':00:00';
            
            calendar.addEvent({
                title: 'Booked - ' + selectedInterviewer,
                start: startTime,
                end: endTime,
                color: '#e0a800'
            });
        }
        
        // Reset form after 3 seconds and close modal
        setTimeout(function() {
            bookingForm.reset();
            timeSection.style.display = 'none';
            timeSlots.forEach(function(s) {
                s.classList.remove('selected');
            });
            modal.style.display = 'none';
        }, 3000);
    });
});