SET @wjh_add_board_template = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'managementBoards'
      AND COLUMN_NAME = 'template'
  ),
  'SELECT 1',
  'ALTER TABLE `managementBoards` ADD `template` varchar(24) DEFAULT ''work'' NOT NULL'
);
--> statement-breakpoint
PREPARE wjh_board_template_stmt FROM @wjh_add_board_template;
--> statement-breakpoint
EXECUTE wjh_board_template_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE wjh_board_template_stmt;
