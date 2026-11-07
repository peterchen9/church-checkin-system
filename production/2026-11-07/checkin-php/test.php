<?php
session_start();
$_SESSION['admin_logged_in'] = true;
$_GET['action'] = 'get_contact';
$_GET['church_id'] = '8110';
require 'api/admin.php';
